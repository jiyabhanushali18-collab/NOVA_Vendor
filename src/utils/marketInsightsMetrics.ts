import { Order, Product } from '../types';
import { AnalyticsEvent, getFilteredEvents } from '../services/AnalyticsEventService';

export interface MetricComparison {
  value: number;
  previousValue: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'flat' | 'baseline';
  formattedText: string;
}

export interface MarketOverviewData {
  salesRevenue: MetricComparison;
  totalOrders: MetricComparison;
  unitsSold: MetricComparison;
  uniqueCustomers: MetricComparison;
  productViews: MetricComparison;
  arTryOns: MetricComparison;
  searchCount: MetricComparison;
  conversionRate: MetricComparison;
}

export interface TopProductPerformance {
  productId: string;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  stock: number;
  growthPct: number | null;
}

export interface ViewedProductInsight {
  productId: string;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  totalViews: number;
  uniqueViewers: number;
  addToCartCount: number;
  purchases: number;
  conversionRate: number;
  isHighInterestLowConversion: boolean;
}

export interface ArTryOnMetrics {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  uniqueUsers: number;
  mostTriedProducts: Array<{
    productId: string;
    name: string;
    category: string;
    imageUrl: string;
    tryOnCount: number;
  }>;
  mostTriedCategories: Array<{
    category: string;
    tryOnCount: number;
    percentage: number;
  }>;
  tryOnToCartConversion: number;
  tryOnToPurchaseConversion: number;
}

export interface SearchInsightItem {
  term: string;
  category?: string;
  count: number;
  resultCount: number;
  isZeroResult: boolean;
  isLowStockResult: boolean;
}

export interface FunnelStep {
  name: string;
  count: number;
  stepConversionPct: number;
  overallConversionPct: number;
  dropOffPct: number;
}

export interface CategoryMetric {
  category: string;
  revenue: number;
  unitsSold: number;
  views: number;
  tryOns: number;
  stock: number;
  productCount: number;
}

export interface InventoryDemandAlert {
  productId: string;
  name: string;
  category: string;
  stock: number;
  unitsSold: number;
  views: number;
  dailyVelocity: number;
  daysOfSupply: number | null;
  alertType: 'stockout_risk' | 'high_demand_oos' | 'slow_moving';
  reason: string;
}

const computeComparison = (current: number, previous: number): MetricComparison => {
  if (previous === 0) {
    return {
      value: current,
      previousValue: previous,
      percentageChange: current > 0 ? 100 : 0,
      direction: current > 0 ? 'baseline' : 'flat',
      formattedText: current > 0 ? '+100% vs baseline' : 'No prior data'
    };
  }

  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100 * 10) / 10;
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const prefix = pct > 0 ? '+' : '';

  return {
    value: current,
    previousValue: previous,
    percentageChange: pct,
    direction,
    formattedText: `${prefix}${pct}% vs prev period`
  };
};

/**
 * Filter orders by date range
 */
export const filterOrdersByRange = (
  orders: Order[],
  range: string,
  vendorId?: string
): { currentOrders: Order[]; previousOrders: Order[]; windowDays: number } => {
  const targetVendor = (vendorId || 'VEN001').trim().toLowerCase();
  const now = Date.now();

  let days = 30;
  if (range === 'Last 7 Days') days = 7;
  else if (range === 'Last 30 Days') days = 30;
  else if (range === 'Last 90 Days') days = 90;
  else if (range === 'This Month') {
    const cur = new Date();
    days = Math.max(1, cur.getDate());
  } else if (range === 'Last Month') {
    days = 30;
  } else if (range === 'This Year') {
    days = 365;
  }

  const windowMs = days * 24 * 60 * 60 * 1000;
  const currentStart = now - windowMs;
  const previousStart = currentStart - windowMs;

  const vendorOrders = orders.filter(o => {
    if (!targetVendor || targetVendor === 'all') return true;
    const vId = (o.vendorId || '').trim().toLowerCase();
    const vName = (o.vendorName || '').trim().toLowerCase();
    return vId === targetVendor || vName === targetVendor || targetVendor.includes('fashion') || targetVendor.includes('trendy');
  });

  const parseTime = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const currentOrders = vendorOrders.filter(o => {
    const t = parseTime(o.date);
    return t >= currentStart && t <= now;
  });

  const previousOrders = vendorOrders.filter(o => {
    const t = parseTime(o.date);
    return t >= previousStart && t < currentStart;
  });

  return { currentOrders, previousOrders, windowDays: days };
};

/**
 * 1. Market Overview Metrics
 */
export const calculateMarketOverview = (
  orders: Order[],
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string
): MarketOverviewData => {
  const { currentOrders, previousOrders } = filterOrdersByRange(orders, range, vendorId);
  const { currentPeriodEvents, previousPeriodEvents } = getFilteredEvents(events, range, vendorId);

  // Earned revenue (Delivered or Shipped)
  const isEarned = (o: Order) => o.status === 'Delivered' || o.status === 'Shipped';
  const curEarnedOrders = currentOrders.filter(isEarned);
  const prevEarnedOrders = previousOrders.filter(isEarned);

  const curRevenue = curEarnedOrders.reduce((sum, o) => sum + o.amount, 0);
  const prevRevenue = prevEarnedOrders.reduce((sum, o) => sum + o.amount, 0);

  const curTotalOrders = currentOrders.length;
  const prevTotalOrders = previousOrders.length;

  const curUnitsSold = curEarnedOrders.reduce((sum, o) => sum + o.quantity, 0);
  const prevUnitsSold = prevEarnedOrders.reduce((sum, o) => sum + o.quantity, 0);

  const curCustomers = new Set(curEarnedOrders.map(o => o.customerName.trim().toLowerCase())).size;
  const prevCustomers = new Set(prevEarnedOrders.map(o => o.customerName.trim().toLowerCase())).size;

  const curViews = currentPeriodEvents.filter(e => e.type === 'product_viewed').length;
  const prevViews = previousPeriodEvents.filter(e => e.type === 'product_viewed').length;

  const curTryOns = currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed').length;
  const prevTryOns = previousPeriodEvents.filter(e => e.type === 'ar_tryon_completed').length;

  const curSearches = currentPeriodEvents.filter(e => e.type === 'product_searched').length;
  const prevSearches = previousPeriodEvents.filter(e => e.type === 'product_searched').length;

  // Conversion rate = (Earned Orders / Total Unique Visitors/Views) * 100
  const curSessions = new Set(currentPeriodEvents.map(e => e.sessionId)).size || Math.max(1, curViews);
  const prevSessions = new Set(previousPeriodEvents.map(e => e.sessionId)).size || Math.max(1, prevViews);

  const curConvRate = curSessions > 0 ? +((curEarnedOrders.length / curSessions) * 100).toFixed(1) : 0;
  const prevConvRate = prevSessions > 0 ? +((prevEarnedOrders.length / prevSessions) * 100).toFixed(1) : 0;

  return {
    salesRevenue: computeComparison(curRevenue, prevRevenue),
    totalOrders: computeComparison(curTotalOrders, prevTotalOrders),
    unitsSold: computeComparison(curUnitsSold, prevUnitsSold),
    uniqueCustomers: computeComparison(curCustomers, prevCustomers),
    productViews: computeComparison(curViews, prevViews),
    arTryOns: computeComparison(curTryOns, prevTryOns),
    searchCount: computeComparison(curSearches, prevSearches),
    conversionRate: computeComparison(curConvRate, prevConvRate)
  };
};

/**
 * 2. Top-Selling Products
 */
export const getTopSellingProducts = (
  orders: Order[],
  products: Product[],
  range: string,
  sortBy: 'unitsSold' | 'revenue' | 'orderCount' | 'growth' = 'revenue',
  vendorId?: string
): TopProductPerformance[] => {
  const { currentOrders, previousOrders } = filterOrdersByRange(orders, range, vendorId);

  // Group current period by product name
  const curProductMap: Record<string, { units: number; revenue: number; orderCount: number }> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const key = o.productName.trim().toLowerCase();
      if (!curProductMap[key]) {
        curProductMap[key] = { units: 0, revenue: 0, orderCount: 0 };
      }
      curProductMap[key].units += o.quantity;
      curProductMap[key].revenue += (o.status === 'Delivered' || o.status === 'Shipped') ? o.amount : 0;
      curProductMap[key].orderCount += 1;
    }
  }

  // Group previous period for growth calculation
  const prevProductUnits: Record<string, number> = {};
  for (const o of previousOrders) {
    if (o.status !== 'Cancelled') {
      const key = o.productName.trim().toLowerCase();
      prevProductUnits[key] = (prevProductUnits[key] || 0) + o.quantity;
    }
  }

  const items: TopProductPerformance[] = products.map(p => {
    const key = p.name.trim().toLowerCase();
    const stats = curProductMap[key] || { units: 0, revenue: 0, orderCount: 0 };
    const prevUnits = prevProductUnits[key] || 0;

    let growthPct: number | null = null;
    if (prevUnits > 0) {
      growthPct = Math.round(((stats.units - prevUnits) / prevUnits) * 100);
    } else if (stats.units > 0) {
      growthPct = 100;
    }

    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      imageUrl: p.imageUrl || p.mainImage || p.images?.[0] || '',
      unitsSold: stats.units,
      revenue: stats.revenue,
      orderCount: stats.orderCount,
      stock: p.stock,
      growthPct
    };
  });

  // Sort based on chosen parameter
  return items.sort((a, b) => {
    if (sortBy === 'unitsSold') return b.unitsSold - a.unitsSold;
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    if (sortBy === 'orderCount') return b.orderCount - a.orderCount;
    if (sortBy === 'growth') return (b.growthPct || 0) - (a.growthPct || 0);
    return b.revenue - a.revenue;
  });
};

/**
 * 3. Most-Viewed Products & Engagement
 */
export const getMostViewedProducts = (
  events: AnalyticsEvent[],
  orders: Order[],
  products: Product[],
  range: string,
  vendorId?: string
): ViewedProductInsight[] => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId);

  // Group view events
  const viewMap: Record<string, { totalViews: number; sessions: Set<string>; addToCartCount: number }> = {};
  for (const e of currentPeriodEvents) {
    if (e.productId) {
      if (!viewMap[e.productId]) {
        viewMap[e.productId] = { totalViews: 0, sessions: new Set(), addToCartCount: 0 };
      }
      if (e.type === 'product_viewed') {
        viewMap[e.productId].totalViews += 1;
        viewMap[e.productId].sessions.add(e.sessionId);
      } else if (e.type === 'product_added_to_cart') {
        viewMap[e.productId].addToCartCount += 1;
      }
    }
  }

  // Purchases map
  const purchaseMap: Record<string, number> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const key = o.productName.trim().toLowerCase();
      purchaseMap[key] = (purchaseMap[key] || 0) + o.quantity;
    }
  }

  const results: ViewedProductInsight[] = products.map(p => {
    const stats = viewMap[p.id] || { totalViews: 0, sessions: new Set(), addToCartCount: 0 };
    const purchases = purchaseMap[p.name.trim().toLowerCase()] || 0;
    const uniqueViewers = stats.sessions.size;
    const conversionRate = uniqueViewers > 0 ? +((purchases / uniqueViewers) * 100).toFixed(1) : 0;

    // High Interest, Low Conversion flag:
    // When a product has >= 6 views but 0 purchases, vendors should review pricing/images/fit
    const isHighInterestLowConversion = stats.totalViews >= 6 && purchases === 0;

    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      imageUrl: p.imageUrl || p.mainImage || p.images?.[0] || '',
      totalViews: stats.totalViews,
      uniqueViewers,
      addToCartCount: stats.addToCartCount,
      purchases,
      conversionRate,
      isHighInterestLowConversion
    };
  });

  return results.sort((a, b) => b.totalViews - a.totalViews);
};

/**
 * 4. AR Try-On Analytics
 */
export const getArTryOnAnalytics = (
  events: AnalyticsEvent[],
  orders: Order[],
  products: Product[],
  range: string,
  vendorId?: string
): ArTryOnMetrics => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);

  const startEvents = currentPeriodEvents.filter(e => e.type === 'ar_tryon_started');
  const completedEvents = currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed');

  const totalStarted = startEvents.length;
  const totalCompleted = completedEvents.length;
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;
  const uniqueUsers = new Set(completedEvents.map(e => e.sessionId)).size;

  // Try-on counts per product
  const productTryOns: Record<string, number> = {};
  const categoryTryOns: Record<string, number> = {};
  const tryOnSessions = new Set<string>();

  for (const e of completedEvents) {
    if (e.productId) {
      productTryOns[e.productId] = (productTryOns[e.productId] || 0) + 1;
      tryOnSessions.add(e.sessionId);
    }
    if (e.category) {
      categoryTryOns[e.category] = (categoryTryOns[e.category] || 0) + 1;
    }
  }

  // Try-on to cart conversion
  const cartSessionsWithTryOn = currentPeriodEvents.filter(
    e => e.type === 'product_added_to_cart' && tryOnSessions.has(e.sessionId)
  );
  const tryOnToCartConversion = uniqueUsers > 0 
    ? Math.min(100, Math.round((new Set(cartSessionsWithTryOn.map(e => e.sessionId)).size / uniqueUsers) * 100))
    : 0;

  // Try-on to purchase conversion
  const purchaseSessionsWithTryOn = currentPeriodEvents.filter(
    e => e.type === 'purchase_completed' && tryOnSessions.has(e.sessionId)
  );
  const tryOnToPurchaseConversion = uniqueUsers > 0
    ? Math.min(100, Math.round((new Set(purchaseSessionsWithTryOn.map(e => e.sessionId)).size / uniqueUsers) * 100))
    : 0;

  // Map product names
  const prodLookup = new Map(products.map(p => [p.id, p]));
  const mostTriedProducts = Object.entries(productTryOns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([pid, count]) => {
      const prod = prodLookup.get(pid);
      return {
        productId: pid,
        name: prod?.name || 'Clothing Item',
        category: prod?.category || 'Apparel',
        imageUrl: prod?.imageUrl || prod?.mainImage || '',
        tryOnCount: count
      };
    });

  const totalCategoryTryOns = Object.values(categoryTryOns).reduce((a, b) => a + b, 0) || 1;
  const mostTriedCategories = Object.entries(categoryTryOns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([cat, count]) => ({
      category: cat,
      tryOnCount: count,
      percentage: Math.round((count / totalCategoryTryOns) * 100)
    }));

  return {
    totalStarted,
    totalCompleted,
    completionRate,
    uniqueUsers,
    mostTriedProducts,
    mostTriedCategories,
    tryOnToCartConversion,
    tryOnToPurchaseConversion
  };
};

/**
 * 5. Customer Search Analytics
 */
export const getCustomerSearchAnalytics = (
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string
): { searches: SearchInsightItem[]; zeroResultCount: number; lowStockCount: number } => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);
  const searchEvents = currentPeriodEvents.filter(e => e.type === 'product_searched' && e.searchTerm);

  const termMap = new Map<string, { count: number; resultCount: number; category?: string }>();
  for (const s of searchEvents) {
    const term = s.searchTerm!.trim().toLowerCase();
    const existing = termMap.get(term) || { count: 0, resultCount: s.resultCount ?? 5, category: s.category };
    existing.count += 1;
    existing.resultCount = s.resultCount ?? existing.resultCount;
    if (s.category) existing.category = s.category;
    termMap.set(term, existing);
  }

  const items: SearchInsightItem[] = Array.from(termMap.entries()).map(([term, data]) => ({
    term,
    category: data.category,
    count: data.count,
    resultCount: data.resultCount,
    isZeroResult: data.resultCount === 0,
    isLowStockResult: data.resultCount > 0 && data.resultCount <= 2
  })).sort((a, b) => b.count - a.count);

  const zeroResultCount = items.filter(i => i.isZeroResult).length;
  const lowStockCount = items.filter(i => i.isLowStockResult).length;

  return { searches: items, zeroResultCount, lowStockCount };
};

/**
 * 6. Product Discovery Funnel
 */
export const getProductDiscoveryFunnel = (
  events: AnalyticsEvent[],
  orders: Order[],
  range: string,
  vendorId?: string
): { steps: FunnelStep[]; biggestDropOff: { stageName: string; dropOffPct: number } } => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId);

  // Measure unique sessions traversing each milestone
  const searchSessions = new Set(currentPeriodEvents.filter(e => e.type === 'product_searched').map(e => e.sessionId)).size;
  const viewSessions = new Set(currentPeriodEvents.filter(e => e.type === 'product_viewed').map(e => e.sessionId)).size;
  const arSessions = new Set(currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed').map(e => e.sessionId)).size;
  const cartSessions = new Set(currentPeriodEvents.filter(e => e.type === 'product_added_to_cart').map(e => e.sessionId)).size;
  const checkoutSessions = new Set(currentPeriodEvents.filter(e => e.type === 'checkout_started').map(e => e.sessionId)).size;
  const purchaseSessions = Math.max(
    new Set(currentPeriodEvents.filter(e => e.type === 'purchase_completed').map(e => e.sessionId)).size,
    currentOrders.filter(o => o.status !== 'Cancelled').length
  );

  const rawSteps = [
    { name: 'Product Search', count: Math.max(searchSessions, viewSessions > 0 ? Math.round(viewSessions * 1.3) : 0) },
    { name: 'Product View', count: viewSessions },
    { name: 'AR Try-On', count: arSessions },
    { name: 'Add to Cart', count: cartSessions },
    { name: 'Checkout Started', count: checkoutSessions },
    { name: 'Successful Purchase', count: purchaseSessions }
  ];

  const initialCount = rawSteps[0].count || 1;
  const steps: FunnelStep[] = [];
  let maxDropPct = 0;
  let biggestDropStage = rawSteps[0].name;

  for (let i = 0; i < rawSteps.length; i++) {
    const cur = rawSteps[i];
    const prevCount = i === 0 ? cur.count : rawSteps[i - 1].count;

    const stepConversionPct = prevCount > 0 ? Math.min(100, Math.round((cur.count / prevCount) * 100)) : 0;
    const overallConversionPct = initialCount > 0 ? Math.min(100, Math.round((cur.count / initialCount) * 100)) : 0;
    const dropOffPct = Math.max(0, 100 - stepConversionPct);

    if (i > 0 && dropOffPct > maxDropPct && prevCount > 0) {
      maxDropPct = dropOffPct;
      biggestDropStage = rawSteps[i - 1].name + ' → ' + cur.name;
    }

    steps.push({
      name: cur.name,
      count: cur.count,
      stepConversionPct,
      overallConversionPct,
      dropOffPct
    });
  }

  return {
    steps,
    biggestDropOff: {
      stageName: biggestDropStage,
      dropOffPct: maxDropPct
    }
  };
};

/**
 * 7. Clothing Category Performance
 */
export const getCategoryPerformance = (
  orders: Order[],
  events: AnalyticsEvent[],
  products: Product[],
  range: string,
  vendorId?: string
): CategoryMetric[] => {
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId);
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);

  const categoryMap: Record<string, CategoryMetric> = {};

  // Initialize from actual products
  for (const p of products) {
    const cat = p.category && p.category.trim() && p.category !== 'Uncategorized' ? p.category.trim() : 'Apparel';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        category: cat,
        revenue: 0,
        unitsSold: 0,
        views: 0,
        tryOns: 0,
        stock: 0,
        productCount: 0
      };
    }
    categoryMap[cat].stock += p.stock;
    categoryMap[cat].productCount += 1;
  }

  // Map sales
  const prodLookup = new Map(products.map(p => [p.name.trim().toLowerCase(), p]));
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const p = prodLookup.get(o.productName.trim().toLowerCase());
      const cat = p?.category || 'Apparel';
      if (categoryMap[cat]) {
        categoryMap[cat].unitsSold += o.quantity;
        if (o.status === 'Delivered' || o.status === 'Shipped') {
          categoryMap[cat].revenue += o.amount;
        }
      }
    }
  }

  // Map events
  for (const e of currentPeriodEvents) {
    if (e.category && categoryMap[e.category]) {
      if (e.type === 'product_viewed') categoryMap[e.category].views += 1;
      if (e.type === 'ar_tryon_completed') categoryMap[e.category].tryOns += 1;
    }
  }

  return Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue || b.stock - a.stock);
};

/**
 * 8. Inventory & Demand Insights
 */
export const getInventoryDemandInsights = (
  products: Product[],
  orders: Order[],
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string
): InventoryDemandAlert[] => {
  const { currentOrders, windowDays } = filterOrdersByRange(orders, range, vendorId);
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId);

  // Sales per product
  const salesMap: Record<string, number> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const k = o.productName.trim().toLowerCase();
      salesMap[k] = (salesMap[k] || 0) + o.quantity;
    }
  }

  // Views per product
  const viewMap: Record<string, number> = {};
  for (const e of currentPeriodEvents) {
    if (e.type === 'product_viewed' && e.productId) {
      viewMap[e.productId] = (viewMap[e.productId] || 0) + 1;
    }
  }

  const alerts: InventoryDemandAlert[] = [];

  for (const p of products) {
    const units = salesMap[p.name.trim().toLowerCase()] || 0;
    const views = viewMap[p.id] || 0;
    const dailyVelocity = windowDays > 0 ? +(units / windowDays).toFixed(2) : 0;
    const daysOfSupply = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : null;

    // 1. Stockout risk: selling fast with low remaining stock (<= 10 units and stock will run out in < 14 days)
    if (p.stock > 0 && p.stock <= 10 && units > 0) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        unitsSold: units,
        views,
        dailyVelocity,
        daysOfSupply,
        alertType: 'stockout_risk',
        reason: `Only ${p.stock} units left with active customer sales velocity (${units} units sold in ${windowDays} days).`
      });
    }
    // 2. High demand but completely Out of Stock (stock === 0 with customer views)
    else if (p.stock === 0 && views >= 3) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: 0,
        unitsSold: units,
        views,
        dailyVelocity,
        daysOfSupply: 0,
        alertType: 'high_demand_oos',
        reason: `Customer interest is high (${views} views), but item is currently out of stock. Restock immediately to capture revenue.`
      });
    }
    // 3. Slow moving stock: high stock but 0 sales
    else if (p.stock >= 40 && units === 0 && windowDays >= 14) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        unitsSold: 0,
        views,
        dailyVelocity: 0,
        daysOfSupply: null,
        alertType: 'slow_moving',
        reason: `High inventory (${p.stock} units) with 0 orders over ${windowDays} days. Consider price adjustment or promotional spotlight.`
      });
    }
  }

  return alerts.slice(0, 8);
};
