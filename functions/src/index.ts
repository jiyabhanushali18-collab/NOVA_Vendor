import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const sendGridApiKey = defineSecret('SENDGRID_API_KEY');
const hmacKey = defineSecret('PASSWORD_RESET_HMAC_KEY');
const fromEmail = defineString('PASSWORD_RESET_FROM_EMAIL');
const CODE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MIN_RESEND_INTERVAL_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const LIMIT_TTL_MS = 24 * 60 * 60 * 1000;

const db = getFirestore();

interface CheckoutItem {
  productId: string;
  quantity: number;
}

interface SalesLine {
  productId: string;
  vendorId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  revenue: number;
  date: string;
}

const readFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readOrderDate = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
};

const normalizeCheckoutItems = (value: unknown): CheckoutItem[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new HttpsError('invalid-argument', 'An order must contain between 1 and 50 products.');
  }

  const quantities = new Map<string, number>();
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new HttpsError('invalid-argument', 'Each order item must include a product and quantity.');
    }
    const item = rawItem as Record<string, unknown>;
    const productId = readNonEmptyString(item.productId);
    const quantity = readFiniteNumber(item.quantity);
    if (!productId || productId.includes('/') || !quantity || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new HttpsError('invalid-argument', 'Order items must have a valid product ID and quantity from 1 to 100.');
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    if (quantities.get(productId)! > 100) {
      throw new HttpsError('invalid-argument', 'The quantity for a product cannot exceed 100.');
    }
  }

  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
};

const parseProductPrice = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numericValue = value.replace(/[^0-9.-]/g, '');
    if (!/^-?\d+(?:\.\d+)?$/.test(numericValue)) return undefined;
    const parsed = Number(numericValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const productName = (product: Record<string, unknown>) =>
  readNonEmptyString(product.name)
  || readNonEmptyString(product.Name)
  || readNonEmptyString(product.productName)
  || readNonEmptyString(product.productTitle)
  || readNonEmptyString(product.title);

const productVendorId = (product: Record<string, unknown>) => {
  const vendor = product.vendor && typeof product.vendor === 'object'
    ? product.vendor as Record<string, unknown>
    : {};
  return readNonEmptyString(product.vendorId) || readNonEmptyString(vendor.id);
};

const productVendorName = (product: Record<string, unknown>) => {
  const vendor = product.vendor && typeof product.vendor === 'object'
    ? product.vendor as Record<string, unknown>
    : {};
  return readNonEmptyString(product.vendorName)
    || readNonEmptyString(product.companyName)
    || readNonEmptyString(product.storeName)
    || readNonEmptyString(vendor.name)
    || 'Vendor';
};

const productImage = (product: Record<string, unknown>) =>
  readNonEmptyString(product.mainImage)
  || readNonEmptyString(product.imageUrl)
  || readNonEmptyString(product.imageurl)
  || readNonEmptyString(product.image)
  || readNonEmptyString(product.photoUrl)
  || (Array.isArray(product.images) ? readNonEmptyString(product.images[0]) : undefined)
  || '';

const productPrice = (product: Record<string, unknown>) =>
  parseProductPrice(product.discountedPrice)
  ?? parseProductPrice(product.DiscountedPrice)
  ?? parseProductPrice(product.salePrice)
  ?? parseProductPrice(product.price)
  ?? parseProductPrice(product.Price)
  ?? parseProductPrice(product.originalPrice)
  ?? parseProductPrice(product.OriginalPrice)
  ?? parseProductPrice(product['Original Price']);

const productStock = (product: Record<string, unknown>) =>
  parseProductPrice(product.stock)
  ?? parseProductPrice(product.Stock)
  ?? parseProductPrice(product.stockQuantity)
  ?? parseProductPrice(product.StockQuantity)
  ?? parseProductPrice(product.stock_quantity)
  ?? parseProductPrice(product.inventory)
  ?? parseProductPrice(product.inventoryCount)
  ?? parseProductPrice(product.availableStock)
  ?? parseProductPrice(product.availableQuantity)
  ?? parseProductPrice(product.quantityAvailable)
  ?? parseProductPrice(product.quantity)
  ?? parseProductPrice(product.qty);

export const placeCustomerOrder = onCall(async request => {
  const customerId = request.auth?.uid;
  if (!customerId) {
    throw new HttpsError('unauthenticated', 'Sign in before placing an order.');
  }

  const requestKey = readNonEmptyString(request.data?.idempotencyKey);
  if (!requestKey || requestKey.length > 128) {
    throw new HttpsError('invalid-argument', 'A stable idempotency key is required for checkout.');
  }
  const requestedItems = normalizeCheckoutItems(request.data?.items);
  const productRefs = requestedItems.map(item => db.collection('products').doc(item.productId));
  const requestHash = createHash('sha256').update(`${customerId}:${requestKey}`).digest('hex');
  const orderRef = db.collection('orders').doc(requestHash);
  const privateOrderRef = db.collection('customerOrders').doc(customerId).collection('orders').doc(requestHash);

  return db.runTransaction(async transaction => {
    const [existingOrder, privateOrder, ...productSnapshots] = await transaction.getAll(
      orderRef,
      privateOrderRef,
      ...productRefs
    );
    if (existingOrder.exists) {
      if (!privateOrder.exists || privateOrder.get('customerId') !== customerId) {
        throw new HttpsError('permission-denied', 'This checkout request is not available.');
      }
      return { orderId: orderRef.id, alreadyPlaced: true };
    }

    const orderItems = requestedItems.map((item, index) => {
      const productSnapshot = productSnapshots[index];
      if (!productSnapshot.exists) {
        throw new HttpsError('not-found', 'A product in your cart is no longer available.');
      }

      const product = productSnapshot.data() || {};
      const vendorId = productVendorId(product);
      const name = productName(product);
      const imageUrl = productImage(product);
      const unitPrice = productPrice(product);
      const stock = productStock(product);
      const status = readNonEmptyString(product.status)?.toLowerCase().replace(/[_-]+/g, ' ');

      if (!vendorId || !name || unitPrice === undefined || unitPrice < 0
        || ['deleted', 'archived', 'inactive', 'disabled', 'out of stock'].includes(status || '')
        || stock === undefined
        || stock < item.quantity) {
        throw new HttpsError('failed-precondition', `${name || 'A product'} is not currently available in the requested quantity.`);
      }

      return {
        productId: productSnapshot.id,
        productName: name,
        productImage: imageUrl,
        vendorId,
        vendorName: productVendorName(product),
        quantity: item.quantity,
        unitPrice,
        totalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
        status: 'Pending'
      };
    });

    const vendorIds = Array.from(new Set(orderItems.map(item => item.vendorId)));
    const totalPrice = Math.round(orderItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
    const now = Timestamp.now();
    const customerName = readNonEmptyString(request.auth?.token.name) || 'NOVA Customer';

    transaction.create(orderRef, {
      orderId: orderRef.id,
      customerName,
      status: 'Pending',
      vendorIds,
      ...(vendorIds.length === 1 ? { vendorId: vendorIds[0] } : {}),
      items: orderItems,
      totalPrice,
      salesEligible: true,
      createdAt: now,
      updatedAt: now
    });
    vendorIds.forEach(vendorId => {
      const vendorItems = orderItems.filter(item => item.vendorId === vendorId);
      const vendorTotal = Math.round(vendorItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
      const vendorOrderRef = db.collection('vendorOrders').doc(vendorId).collection('orders').doc(orderRef.id);
      transaction.create(vendorOrderRef, {
        orderId: orderRef.id,
        customerName,
        vendorId,
        vendorName: vendorItems[0]?.vendorName || 'Vendor',
        productName: vendorItems.length === 1 ? vendorItems[0].productName : `${vendorItems.length} products`,
        ...(vendorItems.length === 1 ? { productId: vendorItems[0].productId } : {}),
        quantity: vendorItems.reduce<number>((sum, item) => sum + item.quantity, 0),
        amount: vendorTotal,
        items: vendorItems,
        status: 'Pending',
        salesEligible: true,
        date: now,
        createdAt: now,
        updatedAt: now
      });
    });
    transaction.create(privateOrderRef, {
      orderId: orderRef.id,
      customerId,
      createdAt: now
    });

    for (const [index, item] of requestedItems.entries()) {
      const product = productSnapshots[index].data() || {};
      const stock = productStock(product);
      if (stock !== undefined) {
        const remainingStock = Math.max(0, stock - item.quantity);
        transaction.update(productRefs[index], {
          stock: remainingStock,
          stockQuantity: remainingStock,
          status: remainingStock > 0 ? 'active' : 'out_of_stock',
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    return { orderId: orderRef.id, alreadyPlaced: false };
  });
});

export const updateVendorOrderStatus = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to update an order.');

  const orderId = readNonEmptyString(request.data?.orderId);
  const nextStatus = readNonEmptyString(request.data?.status);
  if (!orderId || orderId.includes('/')
    || !['Pending', 'Shipped', 'Delivered', 'Cancelled'].includes(nextStatus || '')) {
    throw new HttpsError('invalid-argument', 'A valid order ID and status are required.');
  }

  const ownerRef = db.collection('owner').doc(uid);
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async transaction => {
    const [ownerSnapshot, orderSnapshot] = await transaction.getAll(ownerRef, orderRef);
    const vendorId = readNonEmptyString(ownerSnapshot.get('vendorId'));
    if (!vendorId || !orderSnapshot.exists) {
      throw new HttpsError('not-found', 'The order is not available to this vendor.');
    }

    const order = orderSnapshot.data() || {};
    const vendorOrderRef = db.collection('vendorOrders').doc(vendorId).collection('orders').doc(orderId);
    if (!Array.isArray(order.items)) {
      if (order.vendorId !== vendorId) {
        throw new HttpsError('permission-denied', 'This order belongs to another vendor.');
      }
      const vendorOrderSnapshot = await transaction.get(vendorOrderRef);
      transaction.update(orderRef, {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp()
      });
      if (vendorOrderSnapshot.exists) {
        transaction.update(vendorOrderRef, {
          status: nextStatus,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      return;
    }

    const rawItems = order.items as unknown[];
    const productIds = Array.from(new Set(rawItems.flatMap(rawItem => {
      if (!rawItem || typeof rawItem !== 'object') return [];
      const productId = readNonEmptyString((rawItem as Record<string, unknown>).productId);
      return productId ? [productId] : [];
    })));
    const productRefs = productIds.map(productId => db.collection('products').doc(productId));
    const productSnapshots = productRefs.length ? await transaction.getAll(...productRefs) : [];
    const productVendors = new Map(productSnapshots.map(snapshot => [
      snapshot.id,
      readNonEmptyString(snapshot.data()?.vendorId)
    ]));

    let updatedCount = 0;
    const updatedItems = rawItems.map(rawItem => {
      if (!rawItem || typeof rawItem !== 'object') return rawItem;
      const item = rawItem as Record<string, unknown>;
      const productId = readNonEmptyString(item.productId);
      const actualVendorId = productId ? productVendors.get(productId) : undefined;
      if (!productId || item.vendorId !== vendorId || (actualVendorId && actualVendorId !== vendorId)) return item;
      updatedCount += 1;
      return { ...item, status: nextStatus };
    });

    if (!updatedCount) {
      throw new HttpsError('permission-denied', 'This order has no products belonging to your vendor.');
    }

    const statuses = new Set(updatedItems.map(item => {
      if (!item || typeof item !== 'object') return order.status;
      const status = readNonEmptyString((item as Record<string, unknown>).status);
      return status || order.status || 'Pending';
    }));
    const overallStatus = statuses.size === 1 ? Array.from(statuses)[0] : 'Processing';
    const vendorOrderSnapshot = await transaction.get(vendorOrderRef);
    const vendorItems = updatedItems.filter(item =>
      item && typeof item === 'object'
      && (item as Record<string, unknown>).vendorId === vendorId
    ) as Record<string, unknown>[];
    const vendorAmount = vendorItems.reduce((sum, item) =>
      sum + (readFiniteNumber(item.totalPrice) ?? readFiniteNumber(item.amount) ?? 0), 0);
    const vendorQuantity = vendorItems.reduce((sum, item) =>
      sum + (readFiniteNumber(item.quantity) ?? 0), 0);
    const vendorStatusSet = new Set(vendorItems.map(item => readNonEmptyString(item.status) || overallStatus));
    const vendorStatus = vendorStatusSet.size === 1 ? Array.from(vendorStatusSet)[0] : 'Processing';

    transaction.update(orderRef, {
      items: updatedItems,
      status: overallStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
    if (vendorOrderSnapshot.exists) {
      transaction.update(vendorOrderRef, {
        items: vendorItems,
        quantity: vendorQuantity,
        amount: vendorAmount,
        status: vendorStatus,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  return { updated: true };
});

export const aggregateOrderSales = onDocumentWritten('orders/{orderId}', async event => {
  const orderRef = event.data?.after.ref;
  if (!orderRef) return;

  const contributionRef = db.collection('orderSalesContributions').doc(event.params.orderId);
  await db.runTransaction(async transaction => {
    const [orderSnapshot, contributionSnapshot] = await transaction.getAll(orderRef, contributionRef);
    const previousLines = (contributionSnapshot.get('lines') || []) as SalesLine[];
    const order = orderSnapshot.exists ? orderSnapshot.data() : undefined;
    const orderStatus = readNonEmptyString(order?.status)?.toLowerCase();
    const statusAllowsSales = ['pending', 'processing', 'confirmed', 'placed', 'shipped', 'delivered'].includes(orderStatus || '');
    const rawItems = order?.items;
    const productIds = order && order.salesEligible === true && statusAllowsSales
      && Array.isArray(rawItems)
      ? Array.from(new Set(rawItems.flatMap((item: unknown) => {
        if (!item || typeof item !== 'object') return [];
        const productId = readNonEmptyString((item as Record<string, unknown>).productId);
        return productId && !productId.includes('/') ? [productId] : [];
      })))
      : [];
    const productRefs = productIds.map(productId => db.collection('products').doc(productId));
    const productSnapshots = productRefs.length ? await transaction.getAll(...productRefs) : [];
    const productsById = new Map(productSnapshots.map(snapshot => [
      snapshot.id,
      snapshot.exists ? snapshot.data() || {} : undefined
    ]));
    const orderDate = readOrderDate(order?.createdAt ?? order?.date ?? order?.orderDate);
    const currentByKey = new Map<string, SalesLine>();

    if (order && orderDate && Array.isArray(rawItems) && order.salesEligible === true && statusAllowsSales) {
      for (const rawItem of rawItems) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const item = rawItem as Record<string, unknown>;
        const productId = readNonEmptyString(item.productId);
        const quantity = readFiniteNumber(item.quantity);
        const product = productId ? productsById.get(productId) : undefined;
        const itemVendorId = readNonEmptyString(item.vendorId);
        const vendorId = product ? productVendorId(product) : order.salesEligible === true ? itemVendorId : undefined;
        const name = product
          ? productName(product)
          : order.salesEligible === true
            ? readNonEmptyString(item.productName)
            : undefined;
        const itemStatus = readNonEmptyString(item.status)?.toLowerCase() || orderStatus;
        const itemAllowsSales = ['pending', 'processing', 'confirmed', 'placed', 'shipped', 'delivered'].includes(itemStatus || '');
        if (!itemAllowsSales || !productId || !product || !vendorId || !name
          || !quantity || !Number.isInteger(quantity) || quantity < 1) continue;
        if (itemVendorId && itemVendorId !== vendorId) continue;

        const unitPrice = readFiniteNumber(item.unitPrice) ?? readFiniteNumber(item.price);
        const amount = readFiniteNumber(item.totalPrice)
          ?? readFiniteNumber(item.amount)
          ?? readFiniteNumber(item.subtotal)
          ?? (unitPrice === undefined ? undefined : unitPrice * quantity);
        if (amount === undefined || amount < 0) continue;

        const key = `${vendorId}:${productId}`;
        const previous = currentByKey.get(key);
        currentByKey.set(key, {
          productId,
          vendorId,
          productName: name,
          imageUrl: product ? productImage(product) : readNonEmptyString(item.productImage) || '',
          quantity: (previous?.quantity || 0) + quantity,
          revenue: (previous?.revenue || 0) + amount,
          date: orderDate
        });
      }
    }

    const previousByKey = new Map(previousLines.map(line => [`${line.vendorId}:${line.productId}`, line]));
    const changes = new Map<string, { line: SalesLine; units: number; orders: number; revenue: number }>();
    for (const key of new Set([...previousByKey.keys(), ...currentByKey.keys()])) {
      const previous = previousByKey.get(key);
      const current = currentByKey.get(key);
      const line = current || previous;
      if (!line) continue;
      const change = {
        line: current || line,
        units: (current?.quantity || 0) - (previous?.quantity || 0),
        orders: (current ? 1 : 0) - (previous ? 1 : 0),
        revenue: (current?.revenue || 0) - (previous?.revenue || 0)
      };
      changes.set(key, change);
    }

    const statsRefs = Array.from(changes.values()).flatMap(({ line }) => [
      db.collection('vendorSales').doc(line.vendorId).collection('products').doc(line.productId),
      db.collection('vendorSales').doc(line.vendorId).collection('dailyProducts').doc(`${line.date}_${line.productId}`)
    ]);
    const uniqueStatsRefs = Array.from(new Map(statsRefs.map(ref => [ref.path, ref])).values());
    const statsSnapshots = uniqueStatsRefs.length ? await transaction.getAll(...uniqueStatsRefs) : [];
    const statsByPath = new Map(statsSnapshots.map(snapshot => [snapshot.ref.path, snapshot]));

    for (const { line, units, orders, revenue } of changes.values()) {
      const allTimeRef = db.collection('vendorSales').doc(line.vendorId).collection('products').doc(line.productId);
      const dailyRef = db.collection('vendorSales').doc(line.vendorId).collection('dailyProducts').doc(`${line.date}_${line.productId}`);
      for (const statsRef of [allTimeRef, dailyRef]) {
        const snapshot = statsByPath.get(statsRef.path);
        const data = snapshot?.data() || {};
        const nextUnits = Math.max(0, (readFiniteNumber(data.unitsSold) || 0) + units);
        const nextOrders = Math.max(0, (readFiniteNumber(data.orderCount) || 0) + orders);
        const nextRevenue = Math.max(0, (readFiniteNumber(data.revenue) || 0) + revenue);
        if (nextUnits === 0 && nextOrders === 0 && nextRevenue === 0) {
          if (snapshot?.exists) transaction.delete(statsRef);
        } else {
          transaction.set(statsRef, {
            productId: line.productId,
            vendorId: line.vendorId,
            productName: line.productName,
            imageUrl: line.imageUrl,
            ...(statsRef === dailyRef ? { date: line.date } : {}),
            unitsSold: nextUnits,
            orderCount: nextOrders,
            revenue: Math.round(nextRevenue * 100) / 100,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
    }

    if (currentByKey.size) {
      transaction.set(contributionRef, { lines: Array.from(currentByKey.values()), updatedAt: FieldValue.serverTimestamp() });
    } else if (contributionSnapshot.exists) {
      transaction.delete(contributionRef);
    }
  });
});

export const reindexHistoricalSales = onCall(async request => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Only an administrator can rebuild sales analytics.');
  }

  const cursor = readNonEmptyString(request.data?.cursor);
  let ordersQuery = db.collection('orders').orderBy(FieldPath.documentId()).limit(50);
  if (cursor) ordersQuery = ordersQuery.startAfter(cursor);
  const snapshot = await ordersQuery.get();
  if (snapshot.empty) return { nextCursor: null, complete: true };

  const batch = db.batch();
  snapshot.docs.forEach(order => {
    batch.update(order.ref, { analyticsReindexAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();

  const lastOrderId = snapshot.docs[snapshot.docs.length - 1].id;
  return {
    nextCursor: lastOrderId,
    complete: snapshot.size < 50
  };
});

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return email;
};

const digest = (purpose: string, value: string) =>
  createHmac('sha256', hmacKey.value()).update(`${purpose}:${value}`).digest('hex');

const hashMatches = (expected: string, actual: string) => {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
};

const isUnexpired = (value: unknown, now: number) =>
  value instanceof Timestamp && value.toMillis() > now;

const sendVerificationEmail = async (email: string, code: string) => {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sendGridApiKey.value()}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail.value() },
      subject: 'Your NOVA Vendor Portal verification code',
      content: [{
        type: 'text/html',
        value: `<p>Your NOVA Vendor Portal password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>`
      }]
    })
  });
  if (!response.ok) {
    console.error('SendGrid rejected a password reset email', response.status);
    throw new HttpsError('internal', 'Could not send a verification code. Please try again later.');
  }
};

export const requestVendorPasswordReset = onCall(
  { secrets: [sendGridApiKey, hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const emailHash = digest('email', email);
    const now = Date.now();
    const limitRef = db.collection('passwordResetLimits').doc(emailHash);
    const ipHash = digest('ip', request.rawRequest.ip || 'unknown');
    const ipLimitRef = db.collection('passwordResetIpLimits').doc(ipHash);

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(limitRef);
      const ipSnapshot = await transaction.get(ipLimitRef);
      const data = snapshot.data();
      const ipData = ipSnapshot.data();
      const windowStart = data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
      const requestCount = data?.requestCount ?? 0;
      const lastRequestedAt = data?.lastRequestedAt instanceof Timestamp
        ? data.lastRequestedAt.toMillis()
        : 0;
      const ipWindowStart = ipData?.windowStart instanceof Timestamp
        ? ipData.windowStart.toMillis()
        : 0;
      const ipRequestCount = ipData?.requestCount ?? 0;

      if (now - lastRequestedAt < MIN_RESEND_INTERVAL_MS) {
        throw new HttpsError('resource-exhausted', 'Please wait before requesting another code.');
      }
      if (now - windowStart < 60 * 60 * 1000 && requestCount >= MAX_REQUESTS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Too many code requests. Please try again later.');
      }
      if (now - ipWindowStart < 60 * 60 * 1000 && ipRequestCount >= MAX_REQUESTS_PER_IP_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Too many code requests. Please try again later.');
      }

      transaction.set(limitRef, {
        windowStart: now - windowStart < 60 * 60 * 1000 ? data?.windowStart : Timestamp.fromMillis(now),
        requestCount: now - windowStart < 60 * 60 * 1000 ? requestCount + 1 : 1,
        lastRequestedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + LIMIT_TTL_MS)
      });
      transaction.set(ipLimitRef, {
        windowStart: now - ipWindowStart < 60 * 60 * 1000
          ? ipData?.windowStart
          : Timestamp.fromMillis(now),
        requestCount: now - ipWindowStart < 60 * 60 * 1000 ? ipRequestCount + 1 : 1,
        expiresAt: Timestamp.fromMillis(now + LIMIT_TTL_MS)
      });
    });

    let user;
    try {
      user = await getAuth().getUserByEmail(email);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
        return { accepted: true };
      }
      console.error('Could not look up password reset account', error);
      throw new HttpsError('internal', 'Could not process this request. Please try again later.');
    }

    const [ownerProfile, vendorProfiles] = await Promise.all([
      db.collection('owner').doc(user.uid).get(),
      db.collection('vendors').where('uid', '==', user.uid).limit(1).get()
    ]);
    if (!ownerProfile.exists && vendorProfiles.empty) {
      return { accepted: true };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    await codeRef.set({
      uid: user.uid,
      codeHash: digest('code', `${emailHash}:${code}`),
      expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS),
      attempts: 0,
      createdAt: FieldValue.serverTimestamp()
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (error) {
      try {
        await codeRef.delete();
      } catch (cleanupError) {
        console.error('Could not remove undelivered password reset code', cleanupError);
      }
      console.error('Password reset email delivery failed', error);
    }

    return { accepted: true };
  }
);

export const verifyVendorPasswordResetCode = onCall(
  { secrets: [hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const code = request.data?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Enter the 6-digit verification code.');
    }

    const emailHash = digest('email', email);
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    const challengeToken = randomBytes(32).toString('base64url');
    const now = Date.now();
    const isValid = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(codeRef);
      const data = snapshot.data();
      if (!data || !isUnexpired(data.expiresAt, now) || data.attempts >= MAX_CODE_ATTEMPTS) {
        if (data) transaction.delete(codeRef);
        return false;
      }

      const matches = hashMatches(
        data.codeHash,
        digest('code', `${emailHash}:${code}`)
      );
      if (!matches) {
        if (data.attempts + 1 >= MAX_CODE_ATTEMPTS) {
          transaction.delete(codeRef);
        } else {
          transaction.update(codeRef, { attempts: data.attempts + 1 });
        }
        return false;
      }

      transaction.update(codeRef, {
        challengeTokenHash: digest('challenge', `${emailHash}:${challengeToken}`),
        challengeExpiresAt: Timestamp.fromMillis(now + CHALLENGE_TTL_MS),
        expiresAt: Timestamp.fromMillis(now + CHALLENGE_TTL_MS),
        resetClaimed: false
      });
      return true;
    });

    if (!isValid) {
      throw new HttpsError('invalid-argument', 'The code is invalid or expired. Request a new code and try again.');
    }
    return { challengeToken };
  }
);

export const resetVendorPassword = onCall(
  { secrets: [hmacKey] },
  async request => {
    const email = normalizeEmail(request.data?.email);
    const { challengeToken, newPassword } = request.data ?? {};
    if (typeof challengeToken !== 'string' || challengeToken.length < 32) {
      throw new HttpsError('invalid-argument', 'Verify your email code before resetting your password.');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      throw new HttpsError('invalid-argument', 'Use a password between 6 and 128 characters.');
    }

    const emailHash = digest('email', email);
    const codeRef = db.collection('passwordResetCodes').doc(emailHash);
    const challengeHash = digest('challenge', `${emailHash}:${challengeToken}`);
    const now = Date.now();
    const uid = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(codeRef);
      const data = snapshot.data();
      if (
        !data ||
        data.resetClaimed ||
        !isUnexpired(data.challengeExpiresAt, now) ||
        !hashMatches(data.challengeTokenHash, challengeHash)
      ) {
        throw new HttpsError('failed-precondition', 'Your verification has expired. Request a new code.');
      }
      transaction.update(codeRef, { resetClaimed: true });
      return data.uid as string;
    });

    try {
      await getAuth().updateUser(uid, { password: newPassword });
    } catch (error) {
      await codeRef.update({ resetClaimed: false });
      console.error('Could not update vendor password', error);
      throw new HttpsError('internal', 'Could not reset your password. Please request a new code and try again.');
    }

    try {
      await codeRef.delete();
    } catch (error) {
      console.error('Could not remove consumed password reset code', error);
    }

    return { reset: true };
  }
);
