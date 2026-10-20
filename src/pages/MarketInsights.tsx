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
  RefreshCw, 
  Download, 
  Trash2, 
  Key, 
  CheckCircle, 
  Flame, 
  Info,
  Layers,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Product, ProfileInfo } from '../types';
import { formatRupees, formatRupeesCompact } from '../utils/currency';
import { 
  readStoredEvents, 
  seedSimulatedClothingTraffic, 
  clearStoredAnalyticsEvents, 
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
  getInventoryDemandInsights 
} from '../utils/marketInsightsMetrics';
import { 
  getGeminiApiKey, 
  saveGeminiApiKey, 
  generateAiMarketInsights, 
  AiRecommendation 
} from '../services/GeminiInsightsService';

interface MarketInsightsProps {
  orders: Order[];
  products: Product[];
  profileInfo: ProfileInfo;
  setActiveTab: (tab: string) => void;
}

export default function MarketInsights({ orders, products, profileInfo, setActiveTab }: MarketInsightsProps) {
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');
  const [topSortBy, setTopSortBy] = useState<'revenue' | 'unitsSold' | 'orderCount' | 'growth'>('revenue');
  const [events, setEvents] = useState<AnalyticsEvent[]>(() => readStoredEvents());
  const [activeTabSection, setActiveTabSection] = useState<'overview' | 'products' | 'tryon' | 'funnel' | 'search' | 'ai'>('overview');

  // AI Insights State
  const [aiKey, setAiKey] = useState<string>(() => getGeminiApiKey());
  const [inputKey, setInputKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);
  const [aiError, setAiError] = useState<string>('');

  // Sync events from window events
  useEffect(() => {
    const handleEventLogged = () => {
      setEvents(readStoredEvents());
    };
    window.addEventListener('nova-analytics-event-logged', handleEventLogged);
    return () => window.removeEventListener('nova-analytics-event-logged', handleEventLogged);
  }, []);

  const vendorId = profileInfo.vendorId || 'VEN001';

  // Computed data models
  const overview = useMemo(() => {
    return calculateMarketOverview(orders, events, selectedRange, vendorId);
  }, [orders, events, selectedRange, vendorId]);

  const topSelling = useMemo(() => {
    return getTopSellingProducts(orders, products, selectedRange, topSortBy, vendorId);
  }, [orders, products, selectedRange, topSortBy, vendorId]);

  const mostViewed = useMemo(() => {
    return getMostViewedProducts(events, orders, products, selectedRange, vendorId);
  }, [events, orders, products, selectedRange, vendorId]);

  const arMetrics = useMemo(() => {
    return getArTryOnAnalytics(events, orders, products, selectedRange, vendorId);
  }, [events, orders, products, selectedRange, vendorId]);

  const searchInsights = useMemo(() => {
    return getCustomerSearchAnalytics(events, selectedRange, vendorId);
  }, [events, selectedRange, vendorId]);

  const funnel = useMemo(() => {
    return getProductDiscoveryFunnel(events, orders, selectedRange, vendorId);
  }, [events, orders, selectedRange, vendorId]);

  const categoryPerformance = useMemo(() => {
    return getCategoryPerformance(orders, events, products, selectedRange, vendorId);
  }, [orders, events, products, selectedRange, vendorId]);

  const inventoryDemand = useMemo(() => {
    return getInventoryDemandInsights(products, orders, events, selectedRange, vendorId);
  }, [products, orders, events, selectedRange, vendorId]);

  // Handle Traffic Simulation
  const handleSimulateTraffic = () => {
    seedSimulatedClothingTraffic(products);
    setEvents(readStoredEvents());
  };

  // Handle Event Clearance
  const handleClearEvents = () => {
    if (window.confirm("Clear all recorded local customer analytics events?")) {
      clearStoredAnalyticsEvents();
      setEvents([]);
    }
  };

  // Handle Gemini API Key Save
  const handleSaveApiKey = () => {
    if (inputKey.trim()) {
      saveGeminiApiKey(inputKey.trim());
      setAiKey(inputKey.trim());
      setShowKeyInput(false);
      setInputKey('');
      handleTriggerAiAnalysis(inputKey.trim());
    }
  };

  // Handle Triggering AI Recommendations
  const handleTriggerAiAnalysis = async (explicitKey?: string) => {
    const keyToUse = explicitKey || aiKey || getGeminiApiKey();
    if (!keyToUse) {
      setShowKeyInput(true);
      return;
    }

    setAiLoading(true);
    setAiError('');

    const topCats = categoryPerformance.slice(0, 3).map(c => ({
      name: c.category,
      revenue: c.revenue,
      units: c.unitsSold
    }));

    const topProds = topSelling.slice(0, 4).map(p => ({
      name: p.name,
      category: p.category,
      units: p.unitsSold,
      revenue: p.revenue,
      stock: p.stock
    }));

    const zeroResultTerms = searchInsights.searches.filter(s => s.isZeroResult).map(s => s.term);
    const lowStock = inventoryDemand.filter(a => a.alertType === 'stockout_risk').map(a => ({ name: a.name, stock: a.stock }));

    const res = await generateAiMarketInsights({
      vendorName: profileInfo.storeName || profileInfo.companyName || 'Fashion Fushion',
      reportingPeriod: selectedRange,
      totalRevenue: overview.salesRevenue.value,
      totalOrders: overview.totalOrders.value,
      unitsSold: overview.unitsSold.value,
      totalViews: overview.productViews.value,
      totalArTryOns: overview.arTryOns.value,
      topCategories: topCats,
      topProducts: topProds,
      zeroResultSearches: zeroResultTerms,
      biggestFunnelDrop: `${funnel.biggestDropOff.stageName} (${funnel.biggestDropOff.dropOffPct}% drop-off)`,
      lowStockItems: lowStock
    });

    setAiLoading(false);
    if (res.error) {
      setAiError(res.error);
    } else {
      setAiSummary(res.summary || '');
      setAiRecommendations(res.recommendations);
    }
  };

  // Automatically trigger AI if key already configured and no recommendations yet
  useEffect(() => {
    if (aiKey && aiRecommendations.length === 0 && !aiLoading && !aiError) {
      handleTriggerAiAnalysis(aiKey);
    }
  }, [aiKey]);

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
              AI Market Insights &amp; Analytics
            </h2>
          </div>
          <p className="text-slate-500 font-medium text-sm md:text-base mt-1.5 max-w-3xl">
            Real-time customer discovery, search demand, virtual AR try-on metrics, shopping funnel drop-offs, and verified AI recommendations.
          </p>
        </div>

        {/* Controls: Date Filter & Traffic Tools */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Range Dropdown */}
          <div className="bg-white/80 border border-slate-200/70 shadow-sm flex items-center px-3.5 py-2 rounded-xl gap-2 font-display">
            <Calendar className="w-4 h-4 text-primary" />
            <select 
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
            </select>
          </div>

          {/* Traffic Simulator Button */}
          <button
            onClick={handleSimulateTraffic}
            title="Simulate realistic customer searches, catalog views, and AR try-ons across active clothing items"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-primary text-xs font-bold rounded-xl transition cursor-pointer"
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold font-display">
        {[
          { id: 'overview', label: 'Market Overview', icon: Layers },
          { id: 'products', label: 'Top & Viewed Clothes', icon: Package },
          { id: 'tryon', label: 'AR Try-On Insights', icon: Glasses },
          { id: 'funnel', label: 'Discovery Funnel', icon: SlidersHorizontal },
          { id: 'search', label: 'Search & Demand', icon: Search },
          { id: 'ai', label: 'Gemini AI Insights', icon: Sparkles }
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Market Performance Summary</span>
            <span className="text-[11px] font-semibold text-slate-400">({selectedRange})</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Recorded Events: <strong className="text-slate-700">{events.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Sales Revenue */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Sales Revenue</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overview.salesRevenue.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                overview.salesRevenue.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
              }`}>
                {overview.salesRevenue.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                {overview.salesRevenue.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                {overview.salesRevenue.formattedText}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{formatRupees(overview.salesRevenue.value)}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Earned delivered/shipped orders</p>
            </div>
          </div>

          {/* 2. Total Orders */}
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
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.totalOrders.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{overview.unitsSold.value} total clothing units</p>
            </div>
          </div>

          {/* 3. Product Catalog Views */}
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
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.productViews.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Distinct catalog view events</p>
            </div>
          </div>

          {/* 4. AR Try-Ons Completed */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Virtual AR Try-Ons</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overview.arTryOns.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                overview.arTryOns.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
              }`}>
                {overview.arTryOns.formattedText}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.arTryOns.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Completed try-on sessions</p>
            </div>
          </div>

          {/* 5. Customer Searches */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Search Queries</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overview.searchCount.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                overview.searchCount.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
              }`}>
                {overview.searchCount.formattedText}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.searchCount.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{searchInsights.zeroResultCount} zero-match searches</p>
            </div>
          </div>

          {/* 6. Unique Customers */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Unique Buyers</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overview.uniqueCustomers.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                overview.uniqueCustomers.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
              }`}>
                {overview.uniqueCustomers.formattedText}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.uniqueCustomers.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Purchasing wholesale clients</p>
            </div>
          </div>

          {/* 7. Conversion Rate */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Overall Conversion</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overview.conversionRate.direction === 'up' ? 'text-emerald-600 bg-emerald-50' : 
                overview.conversionRate.direction === 'down' ? 'text-rose-500 bg-rose-50' : 'text-slate-500 bg-slate-100'
              }`}>
                {overview.conversionRate.formattedText}
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{overview.conversionRate.value}%</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Discovery sessions to orders</p>
            </div>
          </div>

          {/* 8. Active Catalog Size */}
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Active Catalog</span>
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {categoryPerformance.length} Categories
              </span>
            </div>
            <div className="mt-4">
              <h4 className="font-display text-2xl font-black text-slate-800">{products.length}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Clothing &amp; apparel models</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 & 3: TOP-SELLING & MOST-VIEWED CLOTHING PRODUCTS */}
      {(activeTabSection === 'overview' || activeTabSection === 'products') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top-Selling Products */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-800">Top-Selling Clothing Items</h3>
                  <p className="text-xs text-slate-400 font-medium">Verified by order line items and completed payments</p>
                </div>
                {/* Sort controls */}
                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                  {(['revenue', 'unitsSold', 'orderCount'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTopSortBy(mode)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${topSortBy === mode ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {mode === 'revenue' ? 'Revenue' : mode === 'unitsSold' ? 'Units' : 'Orders'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {topSelling.filter(p => p.unitsSold > 0).slice(0, 5).map(prod => (
                  <div key={prod.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-slate-100 hover:border-primary/20 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 p-0.5">
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{prod.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">{prod.category}</span>
                          <span className="text-[11px] text-slate-400 font-medium">{prod.unitsSold} units · {prod.orderCount} orders</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-display font-extrabold text-sm text-slate-800">{formatRupees(prod.revenue)}</div>
                      <span className="text-[10px] font-semibold text-slate-400">Stock: {prod.stock}</span>
                    </div>
                  </div>
                ))}

                {topSelling.filter(p => p.unitsSold > 0).length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No product orders recorded for {selectedRange.toLowerCase()}. New sales will automatically be indexed here.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Most-Viewed Products & Engagement Alerts */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-800">Most-Viewed Clothing</h3>
                  <p className="text-xs text-slate-400 font-medium">Customer browsing attention and conversion friction</p>
                </div>
                <Eye className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-3 mt-4">
                {mostViewed.slice(0, 5).map(prod => (
                  <div key={prod.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-slate-100 hover:border-primary/20 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 p-0.5">
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{prod.name}</h4>
                          {prod.isHighInterestLowConversion && (
                            <span 
                              title="High customer views with 0 purchases. Check pricing, photos, or size chart."
                              className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-md shrink-0 flex items-center gap-0.5"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" /> High Interest, Low Conversion
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{prod.category}</span>
                          <span className="text-[11px] text-slate-400 font-medium">{prod.uniqueViewers} unique viewers · {prod.addToCartCount} added to cart</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-display font-extrabold text-sm text-slate-800">{prod.totalViews} views</div>
                      <span className="text-[10px] font-semibold text-emerald-600">{prod.conversionRate}% conv</span>
                    </div>
                  </div>
                ))}

                {mostViewed.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No catalog views recorded yet. Click "Simulate Traffic" above to preview customer browsing.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: AR TRY-ON ANALYTICS */}
      {(activeTabSection === 'overview' || activeTabSection === 'tryon') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Glasses className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">Virtual AR Try-On Intelligence</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Customer virtual fitting sessions, garment drape reviews, and downstream purchase conversion.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold font-display">
              <span className="text-slate-600">Completion: <strong className="text-primary">{arMetrics.completionRate}%</strong></span>
              <span className="text-slate-600">Try-on → Cart: <strong className="text-emerald-600">{arMetrics.tryOnToCartConversion}%</strong></span>
              <span className="text-slate-600">Try-on → Order: <strong className="text-secondary">{arMetrics.tryOnToPurchaseConversion}%</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Most Tried Products */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Most Virtually Tried Products</h4>
              {arMetrics.mostTriedProducts.map(item => (
                <div key={item.productId} className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                    {item.tryOnCount} try-ons
                  </span>
                </div>
              ))}
              {arMetrics.mostTriedProducts.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                  No virtual try-on events logged yet for this reporting period.
                </div>
              )}
            </div>

            {/* Most Tried Categories */}
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

      {/* SECTION 5: CUSTOMER SEARCH ANALYTICS */}
      {(activeTabSection === 'overview' || activeTabSection === 'search') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">Customer Search Demand</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Exact terms buyers and retailers are querying, including zero-match demand opportunities.
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold font-display">
              <span className="text-slate-600">Total Queries: <strong className="text-slate-800">{searchInsights.searches.reduce((a, b) => a + b.count, 0)}</strong></span>
              <span className="text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full">
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
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg shrink-0">
                    {item.count} {item.count === 1 ? 'search' : 'searches'}
                  </span>
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
        </section>
      )}

      {/* SECTION 6: PRODUCT DISCOVERY FUNNEL */}
      {(activeTabSection === 'overview' || activeTabSection === 'funnel') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-slate-800">Product Discovery Funnel</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Session conversion from search queries through garment viewing, AR try-on, cart, and final checkout.
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
                  <span className="text-primary">{step.overallConversionPct}%</span>
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
        </section>
      )}

      {/* SECTION 7: INVENTORY & DEMAND ALERTS */}
      {(activeTabSection === 'overview' || activeTabSection === 'products') && (
        <section className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Inventory &amp; Demand Insights</h3>
              <p className="text-xs text-slate-400 font-medium">Stockout risk forecasts based on real sales velocity and customer browsing</p>
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
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">{alert.reason}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-semibold text-slate-400">
                  <span>Category: {alert.category}</span>
                  {alert.daysOfSupply !== null && (
                    <span className="text-slate-700 font-bold">~{alert.daysOfSupply} days supply left</span>
                  )}
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

      {/* SECTION 8: AI-GENERATED MARKET INSIGHTS (GEMINI POWERED) */}
      {(activeTabSection === 'overview' || activeTabSection === 'ai') && (
        <section className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 md:p-8 rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-violet-500/20 text-violet-300 border border-violet-400/30">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>Google Gemini Commercial Intelligence</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-violet-400/20 text-violet-200 px-2 py-0.5 rounded-full border border-violet-400/20">
                    Live Model
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  AI analysis grounded strictly in verified store metrics, category revenues, and customer search trends.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleTriggerAiAnalysis()}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-display text-xs font-bold shadow-md shadow-primary/30 hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Analyzing Dataset...' : 'Generate AI Insights'}</span>
              </button>

              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                title="Configure Gemini API Key"
                className="p-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-slate-300 hover:text-white transition cursor-pointer border border-white/10"
              >
                <Key className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Key Configuration Modal / Bar */}
          {showKeyInput && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-violet-200">Google Gemini API Key Configuration</span>
                <span className="text-[11px] text-slate-400">Stored safely in your browser localStorage</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Paste your Gemini API Key (e.g. AIzaSy...)"
                  className="flex-1 bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-violet-400"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Save &amp; Analyze
                </button>
              </div>
            </motion.div>
          )}

          {/* AI Status / Error notification */}
          {aiError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-2xl flex items-center justify-between">
              <span>{aiError}</span>
              <button 
                onClick={() => setShowKeyInput(true)} 
                className="underline hover:text-white cursor-pointer ml-3 font-bold"
              >
                Enter API Key
              </button>
            </div>
          )}

          {/* Summary Quote */}
          {aiSummary && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-slate-200 text-xs leading-relaxed font-medium">
              ✨ <strong>Commercial Assessment:</strong> {aiSummary}
            </div>
          )}

          {/* Recommendations Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiRecommendations.map(rec => (
              <div key={rec.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-400/40 transition space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-300 border border-violet-400/20">
                      {rec.category}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                      {rec.confidence} Confidence
                    </span>
                  </div>
                  <h4 className="font-display font-extrabold text-base text-white mt-2">{rec.title}</h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">{rec.observation}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Evidence Metric:</span>
                    <strong className="text-violet-300">{rec.metric}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-400/20 text-violet-200 font-bold text-[11px]">
                    👉 Suggested Action: {rec.suggestedAction}
                  </div>
                </div>
              </div>
            ))}

            {aiRecommendations.length === 0 && !aiLoading && !aiError && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs font-semibold border border-dashed border-white/10 rounded-2xl">
                Click <strong>"Generate AI Insights"</strong> above to run Gemini analysis on your store's sales and customer engagement data.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
