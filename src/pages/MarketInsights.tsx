import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Eye, 
  Search, 
  Glasses, 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  ArrowRight, 
  Download, 
  Trash2, 
  Flame, 
  Info,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  Heart,
  Activity,
  BarChart3,
  Clock,
  Target,
  ShieldAlert
} from 'lucide-react';
import { Order, Product, ProfileInfo } from '../types';
import { formatRupees, formatRupeesCompact } from '../utils/currency';
import { 
  readStoredEvents, 
  seedSimulatedClothingTraffic, 
  clearStoredAnalyticsEvents, 
  subscribeToAnalyticsEvents,
  AnalyticsEvent 
} from '../services/AnalyticsEventService';
import { 
  calculateMarketOverview, 
  getTopSellingProducts, 
  getMostViewedProducts, 
  getArTryOnAnalytics, 
  getCustomerSearchAnalytics, 
  getProductDiscoveryFunnel, 
  getCategoryPerformance, 
  getInventoryDemandInsights,
  getWishlistIntelligence,
  getDeterministicBusinessInsights,
  calculateTimeSeriesTrends
} from '../utils/marketInsightsMetrics';
import { subscribeToVendorSales, type VendorSalesProduct, type VendorSalesRange } from '../services/VendorSalesService';

interface MarketInsightsProps {
  orders: Order[];
  products: Product[];
  profileInfo: ProfileInfo;
  setActiveTab: (tab: string) => void;
}

export default function MarketInsights({ orders, products, profileInfo, setActiveTab }: MarketInsightsProps) {
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ startMs: number; endMs: number } | undefined>(undefined);
  const [topSortBy, setTopSortBy] = useState<'revenue' | 'unitsSold' | 'orderCount' | 'asp' | 'growth'>('revenue');
  const [events, setEvents] = useState<AnalyticsEvent[]>(() => readStoredEvents());
  const [liveSales, setLiveSales] = useState<VendorSalesProduct[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState('');
  const [activeTabSection, setActiveTabSection] = useState<'overview' | 'products' | 'tryon' | 'funnel' | 'search' | 'wishlist' | 'inventory'>('overview');
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'views' | 'tryOns' | 'orders' | 'wishlists'>('revenue');

  const vendorId = profileInfo.vendorId || 'VEN001';
  const vendorProductIds = useMemo(() => new Set(products.map(p => p.id)), [products]);

  // Realtime Firestore Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAnalyticsEvents(
      vendorId,
      (updatedEvents) => {
        setEvents(updatedEvents);
      },
      (err) => {
        console.warn('Realtime analytics listener notice:', err);
      }
    );

    const handleLocalEvent = () => {
      setEvents(readStoredEvents());
    };
    window.addEventListener('nova-analytics-event-logged', handleLocalEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('nova-analytics-event-logged', handleLocalEvent);
    };
  }, [vendorId]);

  useEffect(() => {
    const range: VendorSalesRange = selectedRange === 'Today'
      ? 'Today'
      : selectedRange === 'Last 7 Days'
        ? 'Last 7 Days'
        : selectedRange === 'All Time'
          ? 'All Time'
          : 'Last 30 Days';
    setSalesLoading(true);
    setSalesError('');
    const unsubscribe = subscribeToVendorSales(
      vendorId,
      range,
      sales => {
        setLiveSales(sales);
        setSalesLoading(false);
      },
      error => {
        console.error('Failed to subscribe to live top-selling product analytics', error);
        setSalesError(error.message);
        setSalesLoading(false);
      }
    );
    return unsubscribe;
  }, [vendorId, selectedRange]);

  // Handle Custom Range Apply
  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) return;
    const startMs = new Date(customStartDate + 'T00:00:00').getTime();
    const endMs = new Date(customEndDate + 'T23:59:59').getTime();
    if (startMs <= endMs) {
      setAppliedCustomRange({ startMs, endMs });
    }
  };

  // Computed data models
  const customRangeParam = selectedRange === 'Custom Range' ? appliedCustomRange : undefined;

  const overview = useMemo(() => {
    return calculateMarketOverview(orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const topSelling = useMemo(() => {
    return getTopSellingProducts(orders, products, selectedRange, topSortBy, vendorId, customRangeParam);
  }, [orders, products, selectedRange, topSortBy, vendorId, customRangeParam]);

  const displayedSales = useMemo(() => [...liveSales].sort((a, b) => {
    if (topSortBy === 'unitsSold' || topSortBy === 'growth') return b.unitsSold - a.unitsSold;
    if (topSortBy === 'orderCount') return b.orderCount - a.orderCount;
    if (topSortBy === 'asp') {
      return (b.unitsSold ? b.revenue / b.unitsSold : 0) - (a.unitsSold ? a.revenue / a.unitsSold : 0);
    }
    return b.revenue - a.revenue;
  }), [liveSales, topSortBy]);

  const mostViewed = useMemo(() => {
    return getMostViewedProducts(events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const arMetrics = useMemo(() => {
    return getArTryOnAnalytics(events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const searchInsights = useMemo(() => {
    return getCustomerSearchAnalytics(events, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [events, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const funnel = useMemo(() => {
    return getProductDiscoveryFunnel(events, orders, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [events, orders, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const wishlistIntel = useMemo(() => {
    return getWishlistIntelligence(events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [events, orders, products, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const categoryPerformance = useMemo(() => {
    return getCategoryPerformance(orders, events, products, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [orders, events, products, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const inventoryDemand = useMemo(() => {
    return getInventoryDemandInsights(products, orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [products, orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  const deterministicInsights = useMemo(() => {
    return getDeterministicBusinessInsights(
      overview,
      topSelling,
      mostViewed,
      arMetrics,
      searchInsights,
      inventoryDemand,
      selectedRange
    );
  }, [overview, topSelling, mostViewed, arMetrics, searchInsights, inventoryDemand, selectedRange]);

  const timeSeries = useMemo(() => {
    return calculateTimeSeriesTrends(orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam);
  }, [orders, events, selectedRange, vendorId, vendorProductIds, customRangeParam]);

  // Handle Traffic Simulation
  const handleSimulateTraffic = () => {
    seedSimulatedClothingTraffic(products, vendorId);
    setEvents(readStoredEvents());
  };

  // Handle Event Clearance
  const handleClearEvents = () => {
    if (window.confirm("Clear all recorded customer analytics events in local cache?")) {
      clearStoredAnalyticsEvents();
      setEvents([]);
    }
  };

  // Handle Report Export
  const handleExportReport = () => {
    const reportData = {
      storeName: profileInfo.storeName || profileInfo.companyName,
      vendorId,
      reportingPeriod: selectedRange,
      generatedAt: new Date().toISOString(),
      overview: {
        grossSalesRevenue: overview.salesRevenue.value,
        netSales: overview.netSales.value,
        totalOrders: overview.totalOrders.value,
        unitsSold: overview.unitsSold.value,
        uniqueBuyers: overview.uniqueCustomers.value,
        productViews: overview.productViews.value,
        uniqueViewers: overview.uniqueViewers.value,
        virtualArTryOns: overview.arTryOns.value,
        arSuccessRate: `${overview.arSuccessRate.value}%`,
        wishlistAdditions: overview.wishlistAdditions.value,
        customerSearches: overview.searchCount.value,
        zeroMatchQueries: overview.zeroMatchSearches,
        discoveryToOrderConversion: `${overview.conversionRate.value}%`
      },
      topSellingProducts: topSelling.slice(0, 10).map(p => ({
        name: p.name,
        category: p.category,
        unitsSold: p.unitsSold,
        grossSales: p.grossSales,
        netSales: p.revenue,
        asp: p.asp,
        stock: p.stock,
        growthPct: p.growthPct !== null ? `${p.growthPct}%` : 'N/A'
      })),
      mostViewedProducts: mostViewed.slice(0, 10).map(p => ({
        name: p.name,
        category: p.category,
        views: p.totalViews,
        uniqueViewers: p.uniqueViewers,
        cartAdds: p.addToCartCount,
        purchases: p.purchases,
        conversionRate: `${p.viewToPurchaseConversion}%`
      })),
      arTryOnMetrics: {
        totalStarted: arMetrics.totalStarted,
        totalCompleted: arMetrics.totalCompleted,
        failed: arMetrics.totalFailed,
        successRate: `${arMetrics.completionRate}%`,
        tryOnToCartConversion: `${arMetrics.tryOnToCartConversion}%`,
        tryOnToPurchaseConversion: `${arMetrics.tryOnToPurchaseConversion}%`,
        mostTried: arMetrics.mostTriedProducts
      },
      searchDemand: {
        totalQueries: searchInsights.totalQueries,
        zeroMatchCount: searchInsights.zeroResultCount,
        zeroMatchOpportunities: searchInsights.zeroMatchOpportunities
      },
      inventoryDemandAlerts: inventoryDemand
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-analytics-report-${vendorId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Trend Path Calculation
  const trendSvg = useMemo(() => {
    const points = timeSeries.points;
    if (!points || points.length === 0) return { linePath: '', areaPath: '', coords: [], maxVal: 100 };

    let values: number[] = [];
    if (trendMetric === 'revenue') values = points.map(p => p.revenue);
    else if (trendMetric === 'views') values = points.map(p => p.views);
    else if (trendMetric === 'tryOns') values = points.map(p => p.tryOns);
    else if (trendMetric === 'orders') values = points.map(p => p.orders);
    else if (trendMetric === 'wishlists') values = points.map(p => p.wishlists);

    const maxVal = Math.max(...values, 10);
    const width = 640;
    const height = 160;
    const paddingX = 24;
    const paddingY = 16;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;
    const stepX = points.length > 1 ? usableWidth / (points.length - 1) : 0;

    const coords = values.map((val, idx) => {
      const x = paddingX + idx * stepX;
      const y = height - paddingY - (val / maxVal) * usableHeight;
      return { x, y, raw: val, label: points[idx].dateLabel };
    });

    if (coords.length === 0) return { linePath: '', areaPath: '', coords: [], maxVal };
    if (coords.length === 1) return { linePath: `M ${coords[0].x} ${coords[0].y}`, areaPath: '', coords, maxVal };

    let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? i : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(height - paddingY).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - paddingY).toFixed(1)} Z`;

    return { linePath, areaPath, coords, maxVal };
  }, [timeSeries, trendMetric]);

  return (
    <div className="space-y-8 select-none font-sans mb-24">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl text-white shadow-md shadow-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              Commercial Market Insights &amp; Analytics
            </h2>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-slate-500 font-medium text-sm md:text-base max-w-2xl">
              Real-time customer browsing, Decart virtual AR fitting, search demand, conversion bottlenecks, and grounded business recommendations.
            </p>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-[10px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Scoped ({vendorId})</span>
            </span>
          </div>
        </div>

        {/* Controls: Date Filter, Export, Traffic Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Range Dropdown */}
          <div className="bg-white/80 border border-slate-200/70 shadow-sm flex items-center px-3.5 py-2 rounded-xl gap-2 font-display">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <select 
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option>Today</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
              <option>Last 90 Days</option>
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
              <option>Custom Range</option>
            </select>
          </div>

          {/* Export Report */}
          <button
            onClick={handleExportReport}
            title="Export authoritative market insights report as JSON"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-slate-200/70 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {/* Traffic Simulator Button */}
          <button
            onClick={handleSimulateTraffic}
            title="Simulate realistic customer searches, catalog views, AR fittings, and cart adds across active catalog items"
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-primary text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-primary" />
            <span>Simulate Traffic</span>
          </button>

          {/* Clear Events */}
          {events.length > 0 && (
            <button
              onClick={handleClearEvents}
              title="Clear all stored customer events"
              className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Picker Bar (Shown when Custom Range is active) */}
      {selectedRange === 'Custom Range' && (
        <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-center gap-3 p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-primary/20 shadow-sm text-xs font-display">
          <span className="font-bold text-slate-600">Select Date Window:</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">From:</span>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-semibold outline-none"
              required 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">To:</span>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-semibold outline-none"
              required 
            />
          </div>
          <button 
            type="submit" 
            className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg shadow-sm hover:brightness-110 cursor-pointer"
          >
            Apply Range
          </button>
        </form>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold font-display">
        {[
          { id: 'overview', label: 'Market Overview', icon: Layers },
          { id: 'products', label: 'Top & Viewed Clothes', icon: Package },
          { id: 'tryon', label: 'AR Try-On Insights', icon: Glasses },
          { id: 'funnel', label: 'Discovery Funnel', icon: SlidersHorizontal },
          { id: 'wishlist', label: 'Wishlist & Engagement', icon: Heart },
          { id: 'inventory', label: 'Inventory & Demand', icon: AlertTriangle }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTabSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'bg-white/60 hover:bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: MARKET OVERVIEW BENTO GRID */}
      {activeTabSection === 'overview' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Market Performance Summary</span>
              <span className="text-[11px] font-semibold text-slate-400">({selectedRange})</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Verified Events: <strong className="text-slate-700">{events.length}</strong> · Active SKUs: <strong className="text-slate-700">{products.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gross Revenue */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Gross Sales (GMV)</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  overview.salesRevenue.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                  overview.salesRevenue.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {overview.salesRevenue.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                  {overview.salesRevenue.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                  {overview.salesRevenue.formattedText}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{formatRupees(overview.salesRevenue.value)}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">All valid non-cancelled orders</p>
              </div>
            </div>

            {/* 2. Net Sales Revenue */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Net Earned Sales</span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Delivered / Shipped
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-emerald-700">{formatRupees(overview.netSales.value)}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{overview.unitsSold.value} fulfilled clothing units</p>
              </div>
            </div>

            {/* 3. Total Orders */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Total Orders</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  overview.totalOrders.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                  overview.totalOrders.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {overview.totalOrders.formattedText}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{overview.totalOrders.value}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Across {overview.uniqueCustomers.value} unique buyers</p>
              </div>
            </div>

            {/* 4. Product Catalog Views */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Product Views</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  overview.productViews.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                  overview.productViews.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {overview.productViews.formattedText}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{overview.productViews.value}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{overview.uniqueViewers.value} distinct viewer sessions</p>
              </div>
            </div>

            {/* 5. Virtual AR Try-Ons */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Virtual AR Try-Ons</span>
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {overview.arSuccessRate.value}% Success
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{overview.arTryOns.value}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Completed Decart drape sessions</p>
              </div>
            </div>

            {/* 6. Wishlist Additions */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Wishlist Saves</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  overview.wishlistAdditions.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                  overview.wishlistAdditions.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {overview.wishlistAdditions.formattedText}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{overview.wishlistAdditions.value}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{wishlistIntel.wishlistToCartConversion}% converted to cart</p>
              </div>
            </div>

            {/* 7. Search Queries */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Search Queries</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${overview.zeroMatchSearches > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-500 bg-slate-100'}`}>
                  {overview.zeroMatchSearches} zero-match
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-slate-800">{overview.searchCount.value}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{searchInsights.uniqueSearchSessions} unique search sessions</p>
              </div>
            </div>

            {/* 8. Discovery-to-Order Conversion */}
            <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Funnel Conversion</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${overview.conversionRate.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 bg-slate-100'}`}>
                  {overview.conversionRate.formattedText}
                </span>
              </div>
              <div className="mt-3">
                <h4 className="font-display text-2xl font-black text-primary">{overview.conversionRate.value}%</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Session discovery to placed orders</p>
              </div>
            </div>
          </div>

          {/* TIME-SERIES TREND CURVE */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-base font-bold text-slate-800">Commercial Activity Trends</h4>
                <p className="text-xs text-slate-400 font-medium">Real-time daily cadence across discovery and conversion channels</p>
              </div>
              {/* Metric selector pills */}
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold font-display">
                {[
                  { id: 'revenue', label: 'Revenue' },
                  { id: 'views', label: 'Views' },
                  { id: 'tryOns', label: 'AR Try-On' },
                  { id: 'orders', label: 'Orders' },
                  { id: 'wishlists', label: 'Wishlists' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setTrendMetric(m.id as any)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      trendMetric === m.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Trend Chart */}
            <div className="relative pt-2 pb-4 overflow-hidden">
              <svg className="w-full h-44 overflow-visible" viewBox="0 0 640 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#451ebb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#451ebb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Gridlines */}
                <line x1="24" y1="20" x2="616" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="24" y1="80" x2="616" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="24" y1="144" x2="616" y2="144" stroke="#e2e8f0" strokeWidth="1" />

                {trendSvg.areaPath && (
                  <path d={trendSvg.areaPath} fill="url(#trendGradient)" />
                )}
                {trendSvg.linePath && (
                  <path d={trendSvg.linePath} fill="none" stroke="#451ebb" strokeWidth="3" strokeLinecap="round" />
                )}

                {/* Data points */}
                {trendSvg.coords.map((c, i) => (
                  <g key={i} className="group cursor-pointer">
                    <circle cx={c.x} cy={c.y} r="4" fill="#ffffff" stroke="#451ebb" strokeWidth="2.5" />
                    <circle cx={c.x} cy={c.y} r="8" fill="#451ebb" opacity="0" className="group-hover:opacity-20 transition" />
                  </g>
                ))}
              </svg>

              {/* X-axis date labels */}
              <div className="flex justify-between px-6 mt-1 text-[10px] font-bold text-slate-400 font-display">
                {timeSeries.points.map((p, idx) => (
                  <span key={idx}>{p.dateLabel}</span>
                ))}
              </div>
            </div>
          </div>

          {/* VENDOR BUSINESS INSIGHTS CARDS (Rule-Based Verified Insights) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-base font-bold text-slate-800">Actionable Vendor Business Insights</h4>
                <p className="text-xs text-slate-400 font-medium">Automatic diagnosis calculated directly from your sales and browsing records</p>
              </div>
              <Activity className="w-5 h-5 text-primary" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deterministicInsights.map(insight => (
                <div 
                  key={insight.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 transition ${
                    insight.type === 'growth' ? 'bg-emerald-50/40 border-emerald-200/60' :
                    insight.type === 'bottleneck' ? 'bg-amber-50/40 border-amber-200/60' :
                    insight.type === 'inventory' ? 'bg-rose-50/40 border-rose-200/60' :
                    'bg-violet-50/40 border-violet-200/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                        insight.type === 'growth' ? 'bg-emerald-100 text-emerald-800' :
                        insight.type === 'bottleneck' ? 'bg-amber-100 text-amber-800' :
                        insight.type === 'inventory' ? 'bg-rose-100 text-rose-800' :
                        'bg-violet-100 text-violet-800'
                      }`}>
                        {insight.type === 'growth' ? 'Momentum' : insight.type === 'bottleneck' ? 'Conversion Gap' : insight.type === 'inventory' ? 'Stock Warning' : 'Demand Opportunity'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{insight.comparisonPeriod}</span>
                    </div>
                    <h5 className="font-display font-bold text-sm text-slate-800 mt-2">{insight.title}</h5>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">{insight.observation}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                      <span>Evidence Metric:</span>
                      <strong className="text-slate-800">{insight.metric}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/80 font-bold text-slate-700 text-[11px]">
                      👉 {insight.suggestedAction}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2 & 3: TOP-SELLING & MOST-VIEWED CLOTHING PRODUCTS */}
      {(activeTabSection === 'overview' || activeTabSection === 'products') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top-Selling Clothing Items */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-800">Top-Selling Clothing Items</h3>
                  <p className="text-xs text-slate-400 font-medium">Live product sales from verified Firebase orders</p>
                </div>
                {/* Sort controls */}
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                  {(['revenue', 'unitsSold', 'orderCount', 'asp', 'growth'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTopSortBy(mode)}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${topSortBy === mode ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {mode === 'revenue' ? 'Revenue' : mode === 'unitsSold' ? 'Units' : mode === 'orderCount' ? 'Orders' : mode === 'asp' ? 'ASP' : 'Growth'}
                    </button>
                  ))}
                </div>
              </div>

              {salesLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-2xl">
                  Loading live sales from Firebase...
                </div>
              ) : salesError ? (
                <div role="alert" className="py-8 text-center text-rose-600 text-xs font-semibold border border-dashed border-rose-200 rounded-2xl">
                  Could not load sales analytics: {salesError}
                </div>
              ) : displayedSales.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-2xl">
                  No sales have been indexed for {selectedRange.toLowerCase()}. New verified orders will appear here automatically.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full min-w-[440px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                        <th className="py-2 pr-2 font-bold">Rank</th>
                        <th className="py-2 px-2 font-bold">Product</th>
                        <th className="py-2 px-2 text-right font-bold">Units</th>
                        <th className="py-2 px-2 text-right font-bold">Orders</th>
                        <th className="py-2 pl-2 text-right font-bold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSales.slice(0, 6).map((prod, index) => (
                        <tr key={prod.productId} className="border-b last:border-0 border-slate-100">
                          <td className="py-2.5 pr-2 font-display font-extrabold text-primary">#{index + 1}</td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                {prod.imageUrl && (
                                  <img src={prod.imageUrl || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate">{prod.productName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right text-xs font-bold text-slate-700">{prod.unitsSold}</td>
                          <td className="py-2.5 px-2 text-right text-xs font-semibold text-slate-600">{prod.orderCount}</td>
                          <td className="py-2.5 pl-2 text-right text-xs font-extrabold text-slate-800">{formatRupees(prod.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Most-Viewed Products & Attention Intelligence */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-800">Most-Viewed Clothing</h3>
                  <p className="text-xs text-slate-400 font-medium">Customer browsing attention, wishlist saves, and conversion ratios</p>
                </div>
                <Eye className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-3 mt-4">
                {mostViewed.slice(0, 6).map(prod => (
                  <div key={prod.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-slate-100 hover:border-primary/20 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 p-0.5">
                        <img src={prod.imageUrl || undefined} alt={prod.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{prod.name}</h4>
                          {prod.isHighInterestLowConversion && (
                            <span 
                              title="High customer views with 0 purchases. Check pricing, photos, or size chart."
                              className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-md shrink-0 flex items-center gap-0.5"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" /> High Interest, Low Conv
                            </span>
                          )}
                          {prod.isRisingAttention && !prod.isHighInterestLowConversion && (
                            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded-md shrink-0">
                              Rising Attention
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{prod.category}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {prod.uniqueViewers} viewers · {prod.wishlistCount} saved · {prod.arTryOnCount} AR tried
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-display font-extrabold text-sm text-slate-800">{prod.totalViews} views</div>
                      <span className="text-[10px] font-semibold text-emerald-600">{prod.viewToPurchaseConversion}% conv</span>
                    </div>
                  </div>
                ))}

                {mostViewed.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-2xl">
                    No catalog views recorded yet. Click "Simulate Traffic" above to preview customer browsing.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: AR TRY-ON ANALYTICS (DECART INTELLIGENCE) */}
      {(activeTabSection === 'overview' || activeTabSection === 'tryon') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Glasses className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">Virtual AR Try-On Intelligence (Decart Engine)</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Real customer 3D drape sessions, fitting completions vs aborts, and downstream cart conversion.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold font-display">
              <span className="text-slate-600">Attempts: <strong className="text-slate-800">{arMetrics.totalStarted}</strong></span>
              <span className="text-slate-600">Success: <strong className="text-primary">{arMetrics.completionRate}%</strong></span>
              <span className="text-slate-600">Failed: <strong className="text-rose-500">{arMetrics.totalFailed}</strong></span>
              <span className="text-slate-600">Try-on → Cart: <strong className="text-emerald-600">{arMetrics.tryOnToCartConversion}%</strong></span>
              <span className="text-slate-600">Try-on → Order: <strong className="text-secondary">{arMetrics.tryOnToPurchaseConversion}%</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Most Tried Garments */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Most Virtually Tried Products</h4>
              {arMetrics.mostTriedProducts.map(item => (
                <div key={item.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                      <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      <span className="text-[10px] text-slate-400 font-medium">{item.category} · {item.uniqueSessions} unique shoppers</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {item.tryOnCount} fittings
                    </span>
                    <p className="text-[10px] font-semibold text-emerald-600 mt-1">{item.tryOnToCartRate}% added to cart</p>
                  </div>
                </div>
              ))}
              {arMetrics.mostTriedProducts.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                  No virtual try-on events logged yet for this reporting period.
                </div>
              )}
            </div>

            {/* Most Tried Categories (Fitting Share) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Category Fitting Share</h4>
              {arMetrics.mostTriedCategories.map(cat => (
                <div key={cat.category} className="space-y-1.5 p-3 rounded-2xl bg-white/80 border border-slate-100">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700">{cat.category}</span>
                    <span className="text-primary">{cat.tryOnCount} fittings ({cat.percentage}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{ width: `${cat.percentage}%` }}></div>
                  </div>
                </div>
              ))}
              {arMetrics.mostTriedCategories.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                  Try-on category statistics will appear as shoppers test sizes virtually.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5: CUSTOMER SEARCH DEMAND */}
      {(activeTabSection === 'overview' || activeTabSection === 'search') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">Customer Search Demand &amp; Zero-Match Gaps</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Exact terms buyers and retailers are querying, highlighting unfulfilled assortment demand.
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold font-display">
              <span className="text-slate-600">Total Queries: <strong className="text-slate-800">{searchInsights.totalQueries}</strong></span>
              <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/50">
                Zero-Match Demand: <strong>{searchInsights.zeroResultCount}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {searchInsights.searches.slice(0, 9).map(item => (
              <div 
                key={item.term} 
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  item.isZeroResult ? 'bg-rose-50/50 border-rose-200/60' : 'bg-white/80 border-slate-200/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-display font-extrabold text-sm text-slate-800 capitalize">"{item.term}"</span>
                    {item.category && (
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.trend === 'rising' && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">
                        Rising
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                      {item.count} {item.count === 1 ? 'search' : 'searches'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Catalog Matches:</span>
                  <span className={`font-bold ${item.isZeroResult ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {item.resultCount} {item.resultCount === 1 ? 'item' : 'items'}
                    {item.isZeroResult && ' (Unmet Demand)'}
                  </span>
                </div>
              </div>
            ))}

            {searchInsights.searches.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                No search queries recorded yet for this period. Try searching in the top navigation bar or simulate traffic above.
              </div>
            )}
          </div>

          {/* Zero Match Opportunities Table */}
          {searchInsights.zeroMatchOpportunities.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/60 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 font-display">Assortment Gap Opportunities (Zero-Match Searches)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {searchInsights.zeroMatchOpportunities.slice(0, 4).map((opp, idx) => (
                  <div key={idx} className="p-3 bg-white/80 rounded-xl border border-rose-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800 capitalize">"{opp.term}"</strong>
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded">
                        {opp.count} searches
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{opp.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* SECTION 6: PRODUCT DISCOVERY FUNNEL */}
      {(activeTabSection === 'overview' || activeTabSection === 'funnel') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">6-Stage Product Discovery Funnel</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Session progression from initial search query through product view, virtual AR try-on, cart, and purchase.
              </p>
            </div>
            {funnel.biggestDropOff.dropOffPct > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl text-amber-700 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Largest Bottleneck: {funnel.biggestDropOff.stageName} ({funnel.biggestDropOff.dropOffPct}% drop)</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {funnel.steps.map((step, idx) => (
              <div key={step.name} className="bg-white/80 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 font-display">
                  <span>Step 0{idx + 1}</span>
                  <span className="text-primary font-black">{step.overallConversionPct}%</span>
                </div>
                <div className="my-3">
                  <h4 className="font-display font-extrabold text-xl text-slate-800">{step.count}</h4>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">{step.name}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold flex justify-between">
                  <span>Step Conv:</span>
                  <span className="text-slate-700 font-bold">{step.stepConversionPct}%</span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${step.overallConversionPct}%` }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Diagnostic Note */}
          {funnel.biggestDropOff.diagnosisText && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span><strong>Funnel Diagnosis:</strong> {funnel.biggestDropOff.diagnosisText}</span>
            </div>
          )}
        </section>
      )}

      {/* SECTION 7: WISHLIST & ENGAGEMENT INTELLIGENCE */}
      {(activeTabSection === 'overview' || activeTabSection === 'wishlist') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                <h3 className="font-display text-lg font-bold text-slate-800">Wishlist &amp; Customer Engagement Intelligence</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Garments saved for later, repeat browsing interest, and downstream wishlist-to-cart conversion.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold font-display">
              <span className="text-slate-600">Wishlist Additions: <strong className="text-rose-500">{wishlistIntel.totalWishlistAdditions}</strong></span>
              <span className="text-slate-600">Wishlist → Cart: <strong className="text-emerald-600">{wishlistIntel.wishlistToCartConversion}%</strong></span>
              <span className="text-slate-600">Wishlist → Order: <strong className="text-secondary">{wishlistIntel.wishlistToPurchaseConversion}%</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Most Wishlisted Products */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Most-Wishlisted Garments</h4>
              {wishlistIntel.mostWishlistedProducts.map(item => (
                <div key={item.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                      <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      <span className="text-[10px] text-slate-400 font-medium">{item.category} · {item.uniqueSessions} shoppers</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/50">
                      {item.wishlistCount} saves
                    </span>
                    <p className="text-[10px] font-semibold text-slate-500 mt-1">{item.cartCount} in carts · {item.purchases} bought</p>
                  </div>
                </div>
              ))}
              {wishlistIntel.mostWishlistedProducts.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                  No wishlist events recorded yet for this reporting period.
                </div>
              )}
            </div>

            {/* High Wishlist Low Purchase (Price Resistance) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Wishlist Conversion Gaps (Price Resistance)</h4>
              {wishlistIntel.highWishlistLowPurchaseProducts.map(item => (
                <div key={item.productId} className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shrink-0">
                      <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5">High saves ({item.wishlistCount}) with 0 purchases. Potential discount opportunity.</p>
                    </div>
                  </div>
                </div>
              ))}
              {wishlistIntel.highWishlistLowPurchaseProducts.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                  No price-resistance wishlist bottlenecks detected. Wishlisted products are converting to orders normally.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 8: INVENTORY & DEMAND INSIGHTS */}
      {(activeTabSection === 'overview' || activeTabSection === 'inventory') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Inventory &amp; Demand Insights</h3>
              <p className="text-xs text-slate-400 font-medium">Stockout risk forecasts based on daily sales velocity, remaining stock, and customer interest</p>
            </div>
            <Package className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {inventoryDemand.map(alert => (
              <div 
                key={alert.productId}
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  alert.alertType === 'stockout_risk' ? 'bg-amber-50/50 border-amber-200/70' :
                  alert.alertType === 'high_demand_oos' ? 'bg-rose-50/50 border-rose-200/70' :
                  'bg-slate-50/60 border-slate-200/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      alert.alertType === 'stockout_risk' ? 'bg-amber-100 text-amber-800' :
                      alert.alertType === 'high_demand_oos' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {alert.alertType === 'stockout_risk' ? 'Stockout Risk' : alert.alertType === 'high_demand_oos' ? 'High Demand Out-of-Stock' : 'Slow Moving'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-700">Stock: {alert.stock}</span>
                  </div>
                  <h4 className="font-display font-bold text-sm text-slate-800 mt-2 truncate">{alert.name}</h4>
                  <p className="text-[11px] text-slate-600 font-medium mt-1 leading-relaxed">{alert.reason}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                    <span>Category: {alert.category}</span>
                    {alert.daysOfSupply !== null && (
                      <span className="text-slate-800 font-bold">~{alert.daysOfSupply} days supply</span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-700">
                    👉 {alert.suggestedAction}
                  </div>
                </div>
              </div>
            ))}

            {inventoryDemand.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                No inventory demand alerts. Stock levels are balanced for current customer velocity.
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
}
