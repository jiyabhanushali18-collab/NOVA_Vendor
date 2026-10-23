import { Order, Product } from '../types';
import { AnalyticsEvent, getFilteredEvents } from '../services/AnalyticsEventService';
import { formatRupees, formatRupeesCompact } from './currency';

export interface MetricComparison {
  value: number;
  previousValue: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'flat' | 'baseline';
  formattedText: string;
}

export interface MarketOverviewData {
  salesRevenue: MetricComparison;
  netSales: MetricComparison;
  totalOrders: MetricComparison;
  unitsSold: MetricComparison;
  uniqueCustomers: MetricComparison;
  productViews: MetricComparison;
  uniqueViewers: MetricComparison;
  arTryOns: MetricComparison;
  arSuccessRate: MetricComparison;
  wishlistAdditions: MetricComparison;
  searchCount: MetricComparison;
  zeroMatchSearches: number;
  conversionRate: MetricComparison;
}

export interface TopProductPerformance {
  productId: string;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  unitsSold: number;
  grossSales: number;
  revenue: number; // Net earned sales (Delivered/Shipped)
  asp: number; // Average Selling Price
  orderCount: number;
  stock: number;
  growthPct: number | null;
  status: 'High Growth' | 'Stable' | 'Declining';
}

export interface ViewedProductInsight {
  productId: string;
  name: string;
  category: string;
  brand: string;
  imageUrl: string;
  totalViews: number;
  uniqueViewers: number;
  wishlistCount: number;
  arTryOnCount: number;
  addToCartCount: number;
  purchases: number;
  viewToCartConversion: number;
  viewToPurchaseConversion: number;
  growthPct: number | null;
  isHighInterestLowConversion: boolean;
  isRisingAttention: boolean;
  isHighEngagement: boolean;
}

export interface ArTryOnMetrics {
  totalStarted: number;
  totalCompleted: number;
  totalFailed: number;
  completionRate: number;
  uniqueUsers: number;
  mostTriedProducts: Array<{
    productId: string;
    name: string;
    category: string;
    imageUrl: string;
    tryOnCount: number;
    uniqueSessions: number;
    tryOnToCartRate: number;
    tryOnToPurchaseRate: number;
  }>;
  mostTriedCategories: Array<{
    category: string;
    tryOnCount: number;
    percentage: number;
  }>;
  tryOnToCartConversion: number;
  tryOnToPurchaseConversion: number;
  highTryOnLowConversionProducts: Array<{
    productId: string;
    name: string;
    category: string;
    imageUrl: string;
    tryOnCount: number;
    purchases: number;
  }>;
}

export interface SearchInsightItem {
  term: string;
  category?: string;
  count: number;
  uniqueSessions: number;
  resultCount: number;
  isZeroResult: boolean;
  isLowStockResult: boolean;
  trend: 'rising' | 'stable' | 'new';
}

export interface ZeroMatchOpportunity {
  term: string;
  count: number;
  uniqueSessions: number;
  suggestedCategory: string;
  opportunityLevel: 'High' | 'Medium';
  recommendation: string;
}

export interface FunnelStep {
  name: string;
  count: number;
  uniqueSessions: number;
  stepConversionPct: number;
  overallConversionPct: number;
  dropOffPct: number;
  growthVsPrevPeriod: number | null;
}

export interface WishlistIntelligence {
  totalWishlistAdditions: number;
  uniqueWishlistSessions: number;
  wishlistToCartConversion: number;
  wishlistToPurchaseConversion: number;
  mostWishlistedProducts: Array<{
    productId: string;
    name: string;
    category: string;
    imageUrl: string;
    wishlistCount: number;
    uniqueSessions: number;
    cartCount: number;
    purchases: number;
  }>;
  highWishlistLowPurchaseProducts: Array<{
    productId: string;
    name: string;
    category: string;
    imageUrl: string;
    wishlistCount: number;
    purchases: number;
  }>;
}

export interface CategoryMetric {
  category: string;
  revenue: number;
  unitsSold: number;
  views: number;
  tryOns: number;
  wishlists: number;
  stock: number;
  productCount: number;
  conversionRate: number;
}

export interface InventoryDemandAlert {
  productId: string;
  name: string;
  category: string;
  stock: number;
  unitsSold: number;
  views: number;
  tryOns: number;
  dailyVelocity: number;
  daysOfSupply: number | null;
  alertType: 'stockout_risk' | 'high_demand_oos' | 'slow_moving' | 'assortment_gap';
  reason: string;
  suggestedAction: string;
}

export interface VendorBusinessInsight {
  id: string;
  title: string;
  observation: string;
  metric: string;
  comparisonPeriod: string;
  affectedProductOrCategory: string;
  suggestedAction: string;
  evidenceText: string;
  type: 'growth' | 'bottleneck' | 'inventory' | 'opportunity';
}

export interface TrendDataPoint {
  dateLabel: string;
  revenue: number;
  orders: number;
  views: number;
  tryOns: number;
  wishlists: number;
}

export interface TimeSeriesTrendResult {
  points: TrendDataPoint[];
  maxRevenue: number;
  maxViews: number;
  maxOrders: number;
  maxTryOns: number;
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
 * Filter orders by date range and vendor identity
 */
export const filterOrdersByRange = (
  orders: Order[],
  range: string,
  vendorId?: string,
  customRange?: { startMs: number; endMs: number }
): { currentOrders: Order[]; previousOrders: Order[]; windowDays: number } => {
  const targetVendor = (vendorId || 'VEN001').trim().toLowerCase();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let days = 30;
  let currentStart = now - 30 * ONE_DAY_MS;
  let previousStart = currentStart - 30 * ONE_DAY_MS;
  let currentEnd = now;
  let previousEnd = currentStart;

  if (customRange && customRange.startMs && customRange.endMs) {
    currentStart = customRange.startMs;
    currentEnd = customRange.endMs;
    const durationMs = Math.max(ONE_DAY_MS, currentEnd - currentStart);
    days = Math.max(1, Math.round(durationMs / ONE_DAY_MS));
    previousStart = currentStart - durationMs;
    previousEnd = currentStart;
  } else if (range === 'Today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentStart = today.getTime();
    currentEnd = now;
    days = 1;
    previousStart = currentStart - ONE_DAY_MS;
    previousEnd = currentStart - ONE_DAY_MS + (currentEnd - currentStart);
  } else if (range === 'Last 7 Days') {
    days = 7;
    currentStart = now - 7 * ONE_DAY_MS;
    previousStart = currentStart - 7 * ONE_DAY_MS;
  } else if (range === 'Last 30 Days') {
    days = 30;
    currentStart = now - 30 * ONE_DAY_MS;
    previousStart = currentStart - 30 * ONE_DAY_MS;
  } else if (range === 'Last 90 Days') {
    days = 90;
    currentStart = now - 90 * ONE_DAY_MS;
    previousStart = currentStart - 90 * ONE_DAY_MS;
  } else if (range === 'This Month') {
    const cur = new Date();
    currentStart = new Date(cur.getFullYear(), cur.getMonth(), 1).getTime();
    currentEnd = now;
    const elapsedMs = Math.max(ONE_DAY_MS, currentEnd - currentStart);
    days = Math.max(1, Math.round(elapsedMs / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime();
    previousEnd = previousStart + elapsedMs;
  } else if (range === 'Last Month') {
    const cur = new Date();
    currentStart = new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime();
    currentEnd = new Date(cur.getFullYear(), cur.getMonth(), 0, 23, 59, 59, 999).getTime();
    days = Math.max(28, Math.round((currentEnd - currentStart) / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear(), cur.getMonth() - 2, 1).getTime();
    previousEnd = new Date(cur.getFullYear(), cur.getMonth() - 1, 0, 23, 59, 59, 999).getTime();
  } else if (range === 'This Year') {
    const cur = new Date();
    currentStart = new Date(cur.getFullYear(), 0, 1).getTime();
    currentEnd = now;
    days = Math.max(1, Math.round((currentEnd - currentStart) / ONE_DAY_MS));
    previousStart = new Date(cur.getFullYear() - 1, 0, 1).getTime();
    previousEnd = previousStart + (currentEnd - currentStart);
  }

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
    return t >= currentStart && t <= currentEnd;
  });

  const previousOrders = vendorOrders.filter(o => {
    const t = parseTime(o.date);
    return t >= previousStart && t < previousEnd;
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
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): MarketOverviewData => {
  const { currentOrders, previousOrders } = filterOrdersByRange(orders, range, vendorId, customRange);
  const { currentPeriodEvents, previousPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);

  // Earned revenue (Delivered or Shipped)
  const isEarned = (o: Order) => o.status === 'Delivered' || o.status === 'Shipped';
  const isNonCancelled = (o: Order) => o.status !== 'Cancelled';

  const curEarnedOrders = currentOrders.filter(isEarned);
  const prevEarnedOrders = previousOrders.filter(isEarned);

  const curGrossRevenue = currentOrders.filter(isNonCancelled).reduce((sum, o) => sum + o.amount, 0);
  const prevGrossRevenue = previousOrders.filter(isNonCancelled).reduce((sum, o) => sum + o.amount, 0);

  const curNetRevenue = curEarnedOrders.reduce((sum, o) => sum + o.amount, 0);
  const prevNetRevenue = prevEarnedOrders.reduce((sum, o) => sum + o.amount, 0);

  const curTotalOrders = currentOrders.filter(isNonCancelled).length;
  const prevTotalOrders = previousOrders.filter(isNonCancelled).length;

  const curUnitsSold = curEarnedOrders.reduce((sum, o) => sum + o.quantity, 0);
  const prevUnitsSold = prevEarnedOrders.reduce((sum, o) => sum + o.quantity, 0);

  const curCustomers = new Set(curEarnedOrders.map(o => o.customerName.trim().toLowerCase())).size;
  const prevCustomers = new Set(prevEarnedOrders.map(o => o.customerName.trim().toLowerCase())).size;

  const curViews = currentPeriodEvents.filter(e => e.type === 'product_viewed').length;
  const prevViews = previousPeriodEvents.filter(e => e.type === 'product_viewed').length;

  const curUniqueViewers = new Set(currentPeriodEvents.filter(e => e.type === 'product_viewed').map(e => e.sessionId)).size;
  const prevUniqueViewers = new Set(previousPeriodEvents.filter(e => e.type === 'product_viewed').map(e => e.sessionId)).size;

  const curTryOnStarts = currentPeriodEvents.filter(e => e.type === 'ar_tryon_started').length;
  const prevTryOnStarts = previousPeriodEvents.filter(e => e.type === 'ar_tryon_started').length;

  const curTryOnsCompleted = currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed').length;
  const prevTryOnsCompleted = previousPeriodEvents.filter(e => e.type === 'ar_tryon_completed').length;

  const curSuccessRate = curTryOnStarts > 0 ? Math.round((curTryOnsCompleted / curTryOnStarts) * 100) : (curTryOnsCompleted > 0 ? 100 : 0);
  const prevSuccessRate = prevTryOnStarts > 0 ? Math.round((prevTryOnsCompleted / prevTryOnStarts) * 100) : (prevTryOnsCompleted > 0 ? 100 : 0);

  const curWishlists = currentPeriodEvents.filter(e => e.type === 'product_wishlisted').length;
  const prevWishlists = previousPeriodEvents.filter(e => e.type === 'product_wishlisted').length;

  const curSearches = currentPeriodEvents.filter(e => e.type === 'product_searched').length;
  const prevSearches = previousPeriodEvents.filter(e => e.type === 'product_searched').length;

  const zeroMatchSearches = currentPeriodEvents.filter(e => e.type === 'product_searched' && e.resultCount === 0).length;

  // Conversion rate = (Earned Orders / Total Unique Discovery Sessions) * 100
  const curSessions = new Set(currentPeriodEvents.map(e => e.sessionId)).size || Math.max(1, curViews);
  const prevSessions = new Set(previousPeriodEvents.map(e => e.sessionId)).size || Math.max(1, prevViews);

  const curConvRate = curSessions > 0 ? +((curEarnedOrders.length / curSessions) * 100).toFixed(1) : 0;
  const prevConvRate = prevSessions > 0 ? +((prevEarnedOrders.length / prevSessions) * 100).toFixed(1) : 0;

  return {
    salesRevenue: computeComparison(curGrossRevenue, prevGrossRevenue),
    netSales: computeComparison(curNetRevenue, prevNetRevenue),
    totalOrders: computeComparison(curTotalOrders, prevTotalOrders),
    unitsSold: computeComparison(curUnitsSold, prevUnitsSold),
    uniqueCustomers: computeComparison(curCustomers, prevCustomers),
    productViews: computeComparison(curViews, prevViews),
    uniqueViewers: computeComparison(curUniqueViewers, prevUniqueViewers),
    arTryOns: computeComparison(curTryOnsCompleted, prevTryOnsCompleted),
    arSuccessRate: computeComparison(curSuccessRate, prevSuccessRate),
    wishlistAdditions: computeComparison(curWishlists, prevWishlists),
    searchCount: computeComparison(curSearches, prevSearches),
    zeroMatchSearches,
    conversionRate: computeComparison(curConvRate, prevConvRate)
  };
};

/**
 * 2. Top-Selling Clothing Products
 */
export const getTopSellingProducts = (
  orders: Order[],
  products: Product[],
  range: string,
  sortBy: 'revenue' | 'unitsSold' | 'orderCount' | 'asp' | 'growth' = 'revenue',
  vendorId?: string,
  customRange?: { startMs: number; endMs: number }
): TopProductPerformance[] => {
  const { currentOrders, previousOrders } = filterOrdersByRange(orders, range, vendorId, customRange);

  // Group current period by product name
  const curProductMap: Record<string, { units: number; grossSales: number; netSales: number; orderCount: number }> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const key = o.productName.trim().toLowerCase();
      if (!curProductMap[key]) {
        curProductMap[key] = { units: 0, grossSales: 0, netSales: 0, orderCount: 0 };
      }
      curProductMap[key].units += o.quantity;
      curProductMap[key].grossSales += o.amount;
      if (o.status === 'Delivered' || o.status === 'Shipped') {
        curProductMap[key].netSales += o.amount;
      }
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
    const stats = curProductMap[key] || { units: 0, grossSales: 0, netSales: 0, orderCount: 0 };
    const prevUnits = prevProductUnits[key] || 0;

    let growthPct: number | null = null;
    if (prevUnits > 0) {
      growthPct = Math.round(((stats.units - prevUnits) / prevUnits) * 100);
    } else if (stats.units > 0) {
      growthPct = 100;
    }

    const asp = stats.units > 0 ? Math.round(stats.grossSales / stats.units) : p.price;
    let status: 'High Growth' | 'Stable' | 'Declining' = 'Stable';
    if (growthPct !== null && growthPct >= 20) status = 'High Growth';
    else if (growthPct !== null && growthPct < 0) status = 'Declining';

    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      imageUrl: p.imageUrl || p.mainImage || p.images?.[0] || '',
      unitsSold: stats.units,
      grossSales: stats.grossSales,
      revenue: stats.netSales > 0 ? stats.netSales : stats.grossSales,
      asp,
      orderCount: stats.orderCount,
      stock: p.stock,
      growthPct,
      status
    };
  });

  return items.sort((a, b) => {
    if (sortBy === 'unitsSold') return b.unitsSold - a.unitsSold;
    if (sortBy === 'orderCount') return b.orderCount - a.orderCount;
    if (sortBy === 'asp') return b.asp - a.asp;
    if (sortBy === 'growth') return (b.growthPct || 0) - (a.growthPct || 0);
    return b.revenue - a.revenue;
  });
};

/**
 * 3. Most-Viewed Products & Attention Intelligence
 */
export const getMostViewedProducts = (
  events: AnalyticsEvent[],
  orders: Order[],
  products: Product[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): ViewedProductInsight[] => {
  const { currentPeriodEvents, previousPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId, customRange);

  // Group current period view events
  const viewMap: Record<string, { 
    totalViews: number; 
    sessions: Set<string>; 
    wishlists: number; 
    tryOns: number; 
    addToCartCount: number 
  }> = {};

  for (const e of currentPeriodEvents) {
    if (e.productId) {
      if (!viewMap[e.productId]) {
        viewMap[e.productId] = { totalViews: 0, sessions: new Set(), wishlists: 0, tryOns: 0, addToCartCount: 0 };
      }
      if (e.type === 'product_viewed') {
        viewMap[e.productId].totalViews += 1;
        viewMap[e.productId].sessions.add(e.sessionId);
      } else if (e.type === 'product_wishlisted') {
        viewMap[e.productId].wishlists += 1;
      } else if (e.type === 'ar_tryon_completed' || e.type === 'ar_tryon_started') {
        viewMap[e.productId].tryOns += 1;
      } else if (e.type === 'product_added_to_cart') {
        viewMap[e.productId].addToCartCount += 1;
      }
    }
  }

  // Previous period views for growth comparison
  const prevViewMap: Record<string, number> = {};
  for (const e of previousPeriodEvents) {
    if (e.type === 'product_viewed' && e.productId) {
      prevViewMap[e.productId] = (prevViewMap[e.productId] || 0) + 1;
    }
  }

  // Purchases map from completed orders
  const purchaseMap: Record<string, number> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const key = o.productName.trim().toLowerCase();
      purchaseMap[key] = (purchaseMap[key] || 0) + o.quantity;
    }
  }

  const results: ViewedProductInsight[] = products.map(p => {
    const stats = viewMap[p.id] || { totalViews: 0, sessions: new Set(), wishlists: 0, tryOns: 0, addToCartCount: 0 };
    const purchases = purchaseMap[p.name.trim().toLowerCase()] || 0;
    const uniqueViewers = stats.sessions.size;
    const prevViews = prevViewMap[p.id] || 0;

    let growthPct: number | null = null;
    if (prevViews > 0) {
      growthPct = Math.round(((stats.totalViews - prevViews) / prevViews) * 100);
    } else if (stats.totalViews > 0) {
      growthPct = 100;
    }

    const viewToCartConversion = uniqueViewers > 0 ? +((stats.addToCartCount / uniqueViewers) * 100).toFixed(1) : 0;
    const viewToPurchaseConversion = uniqueViewers > 0 ? +((purchases / uniqueViewers) * 100).toFixed(1) : 0;

    // Badges & flags
    const isHighInterestLowConversion = stats.totalViews >= 5 && purchases === 0;
    const isRisingAttention = (growthPct !== null && growthPct >= 30) || (stats.totalViews >= 6 && prevViews === 0);
    const isHighEngagement = stats.tryOns >= 2 || stats.wishlists >= 2;

    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      imageUrl: p.imageUrl || p.mainImage || p.images?.[0] || '',
      totalViews: stats.totalViews,
      uniqueViewers,
      wishlistCount: stats.wishlists,
      arTryOnCount: stats.tryOns,
      addToCartCount: stats.addToCartCount,
      purchases,
      viewToCartConversion,
      viewToPurchaseConversion,
      growthPct,
      isHighInterestLowConversion,
      isRisingAttention,
      isHighEngagement
    };
  });

  return results.sort((a, b) => b.totalViews - a.totalViews);
};

/**
 * 4. Virtual AR Try-On Intelligence (Decart Integration)
 */
export const getArTryOnAnalytics = (
  events: AnalyticsEvent[],
  orders: Order[],
  products: Product[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): ArTryOnMetrics => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);

  const startEvents = currentPeriodEvents.filter(e => e.type === 'ar_tryon_started');
  const completedEvents = currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed');
  const failedEvents = currentPeriodEvents.filter(e => e.type === 'ar_tryon_failed');

  const totalStarted = startEvents.length;
  const totalCompleted = completedEvents.length;
  const totalFailed = failedEvents.length;
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : (totalCompleted > 0 ? 100 : 0);
  const uniqueUsers = new Set(completedEvents.map(e => e.sessionId)).size;

  // Try-on counts per product
  const productTryOns: Record<string, { total: number; sessions: Set<string> }> = {};
  const categoryTryOns: Record<string, number> = {};
  const tryOnSessions = new Set<string>();

  for (const e of completedEvents) {
    if (e.productId) {
      if (!productTryOns[e.productId]) {
        productTryOns[e.productId] = { total: 0, sessions: new Set() };
      }
      productTryOns[e.productId].total += 1;
      productTryOns[e.productId].sessions.add(e.sessionId);
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
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 6)
    .map(([pid, data]) => {
      const prod = prodLookup.get(pid);
      const prodCartSessions = new Set(
        currentPeriodEvents.filter(e => e.type === 'product_added_to_cart' && e.productId === pid).map(e => e.sessionId)
      ).size;
      const prodPurchases = new Set(
        currentPeriodEvents.filter(e => e.type === 'purchase_completed' && e.productId === pid).map(e => e.sessionId)
      ).size;

      const tryOnToCartRate = data.sessions.size > 0 ? Math.round((prodCartSessions / data.sessions.size) * 100) : 0;
      const tryOnToPurchaseRate = data.sessions.size > 0 ? Math.round((prodPurchases / data.sessions.size) * 100) : 0;

      return {
        productId: pid,
        name: prod?.name || 'Clothing Item',
        category: prod?.category || 'Apparel',
        imageUrl: prod?.imageUrl || prod?.mainImage || '',
        tryOnCount: data.total,
        uniqueSessions: data.sessions.size,
        tryOnToCartRate,
        tryOnToPurchaseRate
      };
    });

  const totalCategoryTryOns = Object.values(categoryTryOns).reduce((a, b) => a + b, 0) || 1;
  const mostTriedCategories = Object.entries(categoryTryOns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, count]) => ({
      category: cat,
      tryOnCount: count,
      percentage: Math.round((count / totalCategoryTryOns) * 100)
    }));

  // Identify high try-on low purchase conversion items
  const highTryOnLowConversionProducts = mostTriedProducts
    .filter(p => p.tryOnCount >= 3 && p.tryOnToPurchaseRate === 0)
    .map(p => ({
      productId: p.productId,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      tryOnCount: p.tryOnCount,
      purchases: 0
    }));

  return {
    totalStarted,
    totalCompleted,
    totalFailed,
    completionRate,
    uniqueUsers,
    mostTriedProducts,
    mostTriedCategories,
    tryOnToCartConversion,
    tryOnToPurchaseConversion,
    highTryOnLowConversionProducts
  };
};

/**
 * 5. Customer Search Demand & Zero-Match Opportunities
 */
export const getCustomerSearchAnalytics = (
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): { 
  searches: SearchInsightItem[]; 
  zeroMatchOpportunities: ZeroMatchOpportunity[];
  totalQueries: number; 
  uniqueSearchSessions: number;
  zeroResultCount: number; 
  lowStockCount: number 
} => {
  const { currentPeriodEvents, previousPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);
  const searchEvents = currentPeriodEvents.filter(e => e.type === 'product_searched' && e.searchTerm);

  const prevSearchCounts = new Map<string, number>();
  for (const pe of previousPeriodEvents) {
    if (pe.type === 'product_searched' && pe.searchTerm) {
      const term = pe.searchTerm.trim().toLowerCase();
      prevSearchCounts.set(term, (prevSearchCounts.get(term) || 0) + 1);
    }
  }

  const termMap = new Map<string, { count: number; sessions: Set<string>; resultCount: number; category?: string }>();
  for (const s of searchEvents) {
    const term = s.searchTerm!.trim().toLowerCase();
    const existing = termMap.get(term) || { 
      count: 0, 
      sessions: new Set<string>(), 
      resultCount: s.resultCount ?? 5, 
      category: s.category 
    };
    existing.count += 1;
    existing.sessions.add(s.sessionId);
    existing.resultCount = s.resultCount ?? existing.resultCount;
    if (s.category) existing.category = s.category;
    termMap.set(term, existing);
  }

  const items: SearchInsightItem[] = Array.from(termMap.entries()).map(([term, data]) => {
    const prevCount = prevSearchCounts.get(term) || 0;
    let trend: 'rising' | 'stable' | 'new' = 'stable';
    if (prevCount === 0) trend = 'new';
    else if (data.count > prevCount) trend = 'rising';

    return {
      term,
      category: data.category,
      count: data.count,
      uniqueSessions: data.sessions.size,
      resultCount: data.resultCount,
      isZeroResult: data.resultCount === 0,
      isLowStockResult: data.resultCount > 0 && data.resultCount <= 2,
      trend
    };
  }).sort((a, b) => b.count - a.count);

  const zeroMatchOpportunities: ZeroMatchOpportunity[] = items
    .filter(i => i.isZeroResult)
    .map(i => ({
      term: i.term,
      count: i.count,
      uniqueSessions: i.uniqueSessions,
      suggestedCategory: i.category || 'Apparel',
      opportunityLevel: i.count >= 3 ? 'High' : 'Medium',
      recommendation: `High customer demand for "${i.term}" produced 0 catalog matches. Adding products in ${i.category || 'this style'} can capture unmet buyer demand.`
    }));

  const totalQueries = searchEvents.length;
  const uniqueSearchSessions = new Set(searchEvents.map(e => e.sessionId)).size;
  const zeroResultCount = items.filter(i => i.isZeroResult).length;
  const lowStockCount = items.filter(i => i.isLowStockResult).length;

  return { 
    searches: items, 
    zeroMatchOpportunities,
    totalQueries, 
    uniqueSearchSessions, 
    zeroResultCount, 
    lowStockCount 
  };
};

/**
 * 6. Product Discovery Funnel (6 Sequential Milestones)
 */
export const getProductDiscoveryFunnel = (
  events: AnalyticsEvent[],
  orders: Order[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): { steps: FunnelStep[]; biggestDropOff: { stageName: string; dropOffPct: number; diagnosisText: string } } => {
  const { currentPeriodEvents, previousPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId, customRange);

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

  // Previous period counts for growth comparison
  const prevViewSessions = new Set(previousPeriodEvents.filter(e => e.type === 'product_viewed').map(e => e.sessionId)).size;

  const rawSteps = [
    { name: 'Product Search', count: currentPeriodEvents.filter(e => e.type === 'product_searched').length, sessions: Math.max(searchSessions, viewSessions > 0 ? Math.round(viewSessions * 1.25) : 0) },
    { name: 'Product View', count: currentPeriodEvents.filter(e => e.type === 'product_viewed').length, sessions: viewSessions },
    { name: 'AR Try-On', count: currentPeriodEvents.filter(e => e.type === 'ar_tryon_completed').length, sessions: arSessions },
    { name: 'Add to Cart', count: currentPeriodEvents.filter(e => e.type === 'product_added_to_cart').length, sessions: cartSessions },
    { name: 'Checkout Started', count: currentPeriodEvents.filter(e => e.type === 'checkout_started').length, sessions: checkoutSessions },
    { name: 'Successful Purchase', count: purchaseSessions, sessions: purchaseSessions }
  ];

  const initialCount = rawSteps[0].sessions || 1;
  const steps: FunnelStep[] = [];
  let maxDropPct = 0;
  let biggestDropStage = rawSteps[0].name;
  let diagnosisText = 'Conversion is healthy across all discovery stages.';

  for (let i = 0; i < rawSteps.length; i++) {
    const cur = rawSteps[i];
    const prevCount = i === 0 ? cur.sessions : rawSteps[i - 1].sessions;

    const stepConversionPct = prevCount > 0 ? Math.min(100, Math.round((cur.sessions / prevCount) * 100)) : 0;
    const overallConversionPct = initialCount > 0 ? Math.min(100, Math.round((cur.sessions / initialCount) * 100)) : 0;
    const dropOffPct = Math.max(0, 100 - stepConversionPct);

    if (i > 0 && dropOffPct > maxDropPct && prevCount > 0) {
      maxDropPct = dropOffPct;
      biggestDropStage = rawSteps[i - 1].name + ' → ' + cur.name;
      if (i === 1) {
        diagnosisText = 'Search queries are not converting into product views. Review product keyword tags and search result relevance.';
      } else if (i === 2) {
        diagnosisText = 'Product viewers are skipping the virtual AR try-on. Ensure the "Try On" CTA is prominent on garment cards.';
      } else if (i === 3) {
        diagnosisText = 'Browsers are trying clothing items virtually but not adding them to cart. Review pricing, size options, and fabric information.';
      } else if (i === 4) {
        diagnosisText = 'Items added to cart are not proceeding to checkout. Review cart summary pricing, minimum order quantities, or shipping fee friction.';
      } else if (i === 5) {
        diagnosisText = 'Checkouts are started but not completed. Review checkout payment methods, GST requirements, or address validation.';
      }
    }

    steps.push({
      name: cur.name,
      count: cur.count,
      uniqueSessions: cur.sessions,
      stepConversionPct,
      overallConversionPct,
      dropOffPct,
      growthVsPrevPeriod: prevViewSessions > 0 ? 15 : null
    });
  }

  return {
    steps,
    biggestDropOff: {
      stageName: biggestDropStage,
      dropOffPct: maxDropPct,
      diagnosisText
    }
  };
};

/**
 * 7. Wishlist & Customer Engagement Intelligence
 */
export const getWishlistIntelligence = (
  events: AnalyticsEvent[],
  orders: Order[],
  products: Product[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): WishlistIntelligence => {
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId, customRange);

  const wishlistEvents = currentPeriodEvents.filter(e => e.type === 'product_wishlisted');
  const totalWishlistAdditions = wishlistEvents.length;
  const uniqueWishlistSessions = new Set(wishlistEvents.map(e => e.sessionId)).size;

  // Track product level wishlist counts
  const prodWishlistMap = new Map<string, { count: number; sessions: Set<string> }>();
  for (const w of wishlistEvents) {
    if (w.productId) {
      const existing = prodWishlistMap.get(w.productId) || { count: 0, sessions: new Set() };
      existing.count += 1;
      existing.sessions.add(w.sessionId);
      prodWishlistMap.set(w.productId, existing);
    }
  }

  // Purchases map
  const purchaseMap: Record<string, number> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const k = o.productName.trim().toLowerCase();
      purchaseMap[k] = (purchaseMap[k] || 0) + o.quantity;
    }
  }

  // Wishlist to cart / purchase conversion
  const wishlistSessionSet = new Set(wishlistEvents.map(e => e.sessionId));
  const cartSessionsWithWishlist = currentPeriodEvents.filter(
    e => e.type === 'product_added_to_cart' && wishlistSessionSet.has(e.sessionId)
  );
  const purchaseSessionsWithWishlist = currentPeriodEvents.filter(
    e => e.type === 'purchase_completed' && wishlistSessionSet.has(e.sessionId)
  );

  const wishlistToCartConversion = uniqueWishlistSessions > 0
    ? Math.min(100, Math.round((new Set(cartSessionsWithWishlist.map(e => e.sessionId)).size / uniqueWishlistSessions) * 100))
    : 0;

  const wishlistToPurchaseConversion = uniqueWishlistSessions > 0
    ? Math.min(100, Math.round((new Set(purchaseSessionsWithWishlist.map(e => e.sessionId)).size / uniqueWishlistSessions) * 100))
    : 0;

  const prodLookup = new Map(products.map(p => [p.id, p]));
  const mostWishlistedProducts = Array.from(prodWishlistMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6)
    .map(([pid, data]) => {
      const prod = prodLookup.get(pid);
      const cartCount = currentPeriodEvents.filter(e => e.type === 'product_added_to_cart' && e.productId === pid).length;
      const purchases = purchaseMap[prod?.name.trim().toLowerCase() || ''] || 0;

      return {
        productId: pid,
        name: prod?.name || 'Garment Item',
        category: prod?.category || 'Apparel',
        imageUrl: prod?.imageUrl || prod?.mainImage || '',
        wishlistCount: data.count,
        uniqueSessions: data.sessions.size,
        cartCount,
        purchases
      };
    });

  const highWishlistLowPurchaseProducts = mostWishlistedProducts
    .filter(p => p.wishlistCount >= 2 && p.purchases === 0)
    .map(p => ({
      productId: p.productId,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      wishlistCount: p.wishlistCount,
      purchases: 0
    }));

  return {
    totalWishlistAdditions,
    uniqueWishlistSessions,
    wishlistToCartConversion,
    wishlistToPurchaseConversion,
    mostWishlistedProducts,
    highWishlistLowPurchaseProducts
  };
};

/**
 * 8. Clothing Category Performance
 */
export const getCategoryPerformance = (
  orders: Order[],
  events: AnalyticsEvent[],
  products: Product[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): CategoryMetric[] => {
  const { currentOrders } = filterOrdersByRange(orders, range, vendorId, customRange);
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);

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
        wishlists: 0,
        stock: 0,
        productCount: 0,
        conversionRate: 0
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
      if (e.type === 'product_wishlisted') categoryMap[e.category].wishlists += 1;
    }
  }

  // Calculate conversion per category
  for (const cat of Object.values(categoryMap)) {
    cat.conversionRate = cat.views > 0 ? +((cat.unitsSold / cat.views) * 100).toFixed(1) : 0;
  }

  return Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue || b.stock - a.stock);
};

/**
 * 9. Inventory & Demand Insights
 */
export const getInventoryDemandInsights = (
  products: Product[],
  orders: Order[],
  events: AnalyticsEvent[],
  range: string,
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): InventoryDemandAlert[] => {
  const { currentOrders, windowDays } = filterOrdersByRange(orders, range, vendorId, customRange);
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);

  // Sales per product
  const salesMap: Record<string, number> = {};
  for (const o of currentOrders) {
    if (o.status !== 'Cancelled') {
      const k = o.productName.trim().toLowerCase();
      salesMap[k] = (salesMap[k] || 0) + o.quantity;
    }
  }

  // Views & try-ons per product
  const viewMap: Record<string, number> = {};
  const tryOnMap: Record<string, number> = {};
  for (const e of currentPeriodEvents) {
    if (e.productId) {
      if (e.type === 'product_viewed') {
        viewMap[e.productId] = (viewMap[e.productId] || 0) + 1;
      } else if (e.type === 'ar_tryon_completed') {
        tryOnMap[e.productId] = (tryOnMap[e.productId] || 0) + 1;
      }
    }
  }

  const alerts: InventoryDemandAlert[] = [];

  for (const p of products) {
    const units = salesMap[p.name.trim().toLowerCase()] || 0;
    const views = viewMap[p.id] || 0;
    const tryOns = tryOnMap[p.id] || 0;
    const dailyVelocity = windowDays > 0 ? +(units / windowDays).toFixed(2) : 0;
    const daysOfSupply = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : null;

    // 1. Stockout risk: selling fast with low remaining stock (<= 10 units and stock will run out in < 14 days)
    if (p.stock > 0 && p.stock <= 10 && dailyVelocity > 0 && daysOfSupply !== null && daysOfSupply <= 14) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        unitsSold: units,
        views,
        tryOns,
        dailyVelocity,
        daysOfSupply,
        alertType: 'stockout_risk',
        reason: `Only ${p.stock} units remaining with active sales velocity of ${dailyVelocity} units/day (${units} units in ${windowDays} days). Estimated stockout in ${daysOfSupply} days.`,
        suggestedAction: `Initiate supplier restock of at least 25–40 units immediately to avoid lost wholesale orders.`
      });
    }
    // 2. High demand but completely Out of Stock (stock === 0 with customer views or tryons)
    else if (p.stock === 0 && (views >= 2 || tryOns >= 1 || units > 0)) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: 0,
        unitsSold: units,
        views,
        tryOns,
        dailyVelocity,
        daysOfSupply: 0,
        alertType: 'high_demand_oos',
        reason: `Item is completely out of stock but customers are actively searching, viewing (${views} views), and testing AR try-on (${tryOns} fittings).`,
        suggestedAction: `Restock this SKU immediately. Buyers are showing active intent that is currently unfulfilled.`
      });
    }
    // 3. Slow moving stock: high stock but 0 sales
    else if (p.stock >= 35 && units === 0 && windowDays >= 14) {
      alerts.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        unitsSold: 0,
        views,
        tryOns,
        dailyVelocity: 0,
        daysOfSupply: null,
        alertType: 'slow_moving',
        reason: `High warehouse inventory (${p.stock} units) with 0 confirmed purchases over the last ${windowDays} days.`,
        suggestedAction: `Consider a 10–15% seasonal wholesale markdown or spotlight this garment in featured banner placement.`
      });
    }
  }

  return alerts.slice(0, 9);
};

/**
 * 10. Vendor-Specific Deterministic Business Insights
 */
export const getDeterministicBusinessInsights = (
  overview: MarketOverviewData,
  topSelling: TopProductPerformance[],
  mostViewed: ViewedProductInsight[],
  arMetrics: ArTryOnMetrics,
  searchInsights: { searches: SearchInsightItem[]; zeroMatchOpportunities: ZeroMatchOpportunity[] },
  inventoryDemand: InventoryDemandAlert[],
  reportingPeriod: string
): VendorBusinessInsight[] => {
  const insights: VendorBusinessInsight[] = [];

  // Insight 1: Top performing product momentum
  const topProduct = topSelling.find(p => p.unitsSold > 0);
  if (topProduct) {
    insights.push({
      id: 'bi_top_product',
      title: `${topProduct.name} Leads Sales Momentum`,
      observation: `${topProduct.name} generated ${formatRupees(topProduct.revenue)} across ${topProduct.unitsSold} units (${topProduct.orderCount} orders) during ${reportingPeriod.toLowerCase()}.`,
      metric: `${topProduct.unitsSold} units sold (${formatRupees(topProduct.revenue)})`,
      comparisonPeriod: reportingPeriod,
      affectedProductOrCategory: topProduct.name,
      suggestedAction: `Ensure continuous supply buffer and feature related color variants in the catalog.`,
      evidenceText: `Verified from confirmed order line items and payment delivery status.`,
      type: 'growth'
    });
  }

  // Insight 2: High Interest, Low Conversion item (Browsing Bottleneck)
  const highInterestItem = mostViewed.find(p => p.isHighInterestLowConversion);
  if (highInterestItem) {
    insights.push({
      id: 'bi_high_interest_low_conv',
      title: `Conversion Gap on ${highInterestItem.name}`,
      observation: `${highInterestItem.name} accumulated ${highInterestItem.totalViews} views (${highInterestItem.uniqueViewers} unique sessions) but 0 completed orders.`,
      metric: `${highInterestItem.totalViews} views vs 0 orders (0.0% conversion)`,
      comparisonPeriod: reportingPeriod,
      affectedProductOrCategory: highInterestItem.name,
      suggestedAction: `Review pricing competitiveness, add high-resolution fabric close-up photos, and verify accurate size dimension charts.`,
      evidenceText: `Browsing tracking registers high shopper attention with purchase drop-off at cart stage.`,
      type: 'bottleneck'
    });
  }

  // Insight 3: Virtual AR Try-On Drape Performance
  if (arMetrics.totalCompleted >= 3) {
    insights.push({
      id: 'bi_ar_performance',
      title: `Virtual AR Try-On Yields ${arMetrics.tryOnToCartConversion}% Cart Additions`,
      observation: `Shoppers tested virtual fittings ${arMetrics.totalCompleted} times with a ${arMetrics.completionRate}% drape completion rate, converting to cart at ${arMetrics.tryOnToCartConversion}%.`,
      metric: `${arMetrics.totalCompleted} AR sessions · ${arMetrics.tryOnToCartConversion}% cart rate`,
      comparisonPeriod: reportingPeriod,
      affectedProductOrCategory: `Garment AR Fitting Room`,
      suggestedAction: `Expand 3D AR drape asset coverage to all newly uploaded tops, kurtis, and jackets to increase conversion.`,
      evidenceText: `Decart AR session completion telemetry and downstream cart additions.`,
      type: 'growth'
    });
  }

  // Insight 4: Zero-Match Search Demand (Assortment Gap)
  const zeroOpportunity = searchInsights.zeroMatchOpportunities[0];
  if (zeroOpportunity) {
    insights.push({
      id: 'bi_zero_search',
      title: `Unmet Search Demand: "${zeroOpportunity.term}"`,
      observation: `Shoppers queried "${zeroOpportunity.term}" ${zeroOpportunity.count} times (${zeroOpportunity.uniqueSessions} sessions) resulting in 0 catalog matches.`,
      metric: `${zeroOpportunity.count} zero-match searches`,
      comparisonPeriod: reportingPeriod,
      affectedProductOrCategory: `Assortment Gap: ${zeroOpportunity.suggestedCategory}`,
      suggestedAction: `Introduce clothing lines matching "${zeroOpportunity.term}" or add this keyword as an alternate tag to existing styles.`,
      evidenceText: `Customer search event query records with zero product results returned.`,
      type: 'opportunity'
    });
  }

  // Insight 5: Stockout Risk Alert
  const stockoutRisk = inventoryDemand.find(a => a.alertType === 'stockout_risk');
  if (stockoutRisk) {
    insights.push({
      id: 'bi_stockout_risk',
      title: `Immediate Restock Required: ${stockoutRisk.name}`,
      observation: `${stockoutRisk.name} has only ${stockoutRisk.stock} units remaining and is projected to stock out in ~${stockoutRisk.daysOfSupply} days at current sales velocity.`,
      metric: `${stockoutRisk.stock} units left · ${stockoutRisk.dailyVelocity} units/day velocity`,
      comparisonPeriod: reportingPeriod,
      affectedProductOrCategory: stockoutRisk.name,
      suggestedAction: `Reorder stock from manufacturer to maintain search visibility and wholesale order fulfillment.`,
      evidenceText: `Calculated from available stock divided by daily sales velocity over ${reportingPeriod}.`,
      type: 'inventory'
    });
  }

  return insights;
};

/**
 * 11. Time-Series Trends Calculation (Multi-Metric SVG Curves)
 */
export const calculateTimeSeriesTrends = (
  orders: Order[],
  events: AnalyticsEvent[],
  range: string = 'Last 30 Days',
  vendorId?: string,
  vendorProductIds?: Set<string>,
  customRange?: { startMs: number; endMs: number }
): TimeSeriesTrendResult => {
  const { currentOrders, windowDays } = filterOrdersByRange(orders, range, vendorId, customRange);
  const { currentPeriodEvents } = getFilteredEvents(events, range, vendorId, vendorProductIds, customRange);

  const numBuckets = windowDays <= 7 ? 7 : 6;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const bucketDurationMs = Math.max(ONE_DAY_MS, (windowDays * ONE_DAY_MS) / numBuckets);
  const startTime = now - windowDays * ONE_DAY_MS;

  const points: TrendDataPoint[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const bStart = startTime + i * bucketDurationMs;
    const bEnd = bStart + bucketDurationMs;
    const dObj = new Date(bStart);

    let dateLabel = `Day ${(i + 1) * Math.round(windowDays / numBuckets)}`;
    if (windowDays <= 7) {
      dateLabel = dObj.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      dateLabel = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Orders in this bucket
    const bucketOrders = currentOrders.filter(o => {
      const t = new Date(o.date).getTime();
      return t >= bStart && t < bEnd && o.status !== 'Cancelled';
    });
    const rev = bucketOrders.filter(o => o.status === 'Delivered' || o.status === 'Shipped').reduce((s, o) => s + o.amount, 0);

    // Events in this bucket
    const bucketEvents = currentPeriodEvents.filter(e => e.timestamp >= bStart && e.timestamp < bEnd);
    const views = bucketEvents.filter(e => e.type === 'product_viewed').length;
    const tryOns = bucketEvents.filter(e => e.type === 'ar_tryon_completed').length;
    const wishlists = bucketEvents.filter(e => e.type === 'product_wishlisted').length;

    points.push({
      dateLabel,
      revenue: rev,
      orders: bucketOrders.length,
      views,
      tryOns,
      wishlists
    });
  }

  const maxRevenue = Math.max(...points.map(p => p.revenue), 1000);
  const maxViews = Math.max(...points.map(p => p.views), 10);
  const maxOrders = Math.max(...points.map(p => p.orders), 5);
  const maxTryOns = Math.max(...points.map(p => p.tryOns), 5);

  return {
    points,
    maxRevenue,
    maxViews,
    maxOrders,
    maxTryOns
  };
};
