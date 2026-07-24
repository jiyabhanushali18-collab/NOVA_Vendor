import React, { useState } from 'react';
import { 
  Truck, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  RotateCw, 
  User, 
  ChevronRight,
  ArrowRight,
  Sparkles,
  Eye,
  Filter,
  Search,
  Activity as ActivityIcon,
  ShoppingCart,
  Package
} from 'lucide-react';
import { Product, Order, Activity, ProfileInfo } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatRupeesCompact } from '../utils/currency';

interface DashboardProps {
  products: Product[];
  orders: Order[];
  activities: Activity[];
  profileInfo: ProfileInfo;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ 
  products, 
  orders, 
  activities, 
  profileInfo, 
  setActiveTab 
}: DashboardProps) {
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ x: number; y: number; val1: string; val2: string; label: string } | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);

  const vendorCounts = products.reduce((map, product) => {
    const vendorName = product.vendorName?.trim() || profileInfo.storeName || profileInfo.companyName || 'Unknown Vendor';
    const count = map.get(vendorName) ?? 0;
    map.set(vendorName, count + 1);
    return map;
  }, new Map<string, number>());

  const vendors = [
    { id: 'all', label: 'All Vendors', count: products.length },
    ...Array.from(vendorCounts.entries()).map(([name, count]) => ({ id: name, label: name, count }))
  ];

  const topRatedProducts = [...products]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 3);

  // Derive metrics dynamically from state to show craftsmanship!
  const totalProductsCount = products.length;
  const lowStockCount = products.filter(p => p.stock < 30).length;
  const totalOrdersCount = orders.length;
  const calculatedRevenue = orders.reduce((acc, o) => acc + (o.status !== 'Cancelled' ? o.amount : 0), 0);

  // Revenue graph path info
  const points1 = [
    { x: 40, y: 220, label: 'Day 5', val1: '₹12k', val2: '₹8k' },
    { x: 160, y: 190, label: 'Day 10', val1: '₹18k', val2: '₹11k' },
    { x: 280, y: 210, label: 'Day 15', val1: '₹15k', val2: '₹13k' },
    { x: 400, y: 130, label: 'Day 20', val1: '₹32k', val2: '₹17k' },
    { x: 520, y: 170, label: 'Day 25', val1: '₹24k', val2: '₹21k' },
    { x: 640, y: 70, label: 'Day 30', val1: '₹42k', val2: '₹24k' }
  ];

  return (
    <div className="space-y-8 select-none font-sans mb-16">
      {/* Hero Section / Quick Actions */}
      <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
            Welcome back, {profileInfo.storeName}
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
            Here's your supply performance for the last 30 days.
          </p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('orders')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-all duration-200 cursor-pointer text-sm"
          >
            <ShoppingCart className="w-4 h-4 text-slate-500" />
            <span>View Orders</span>
          </button>
          <button 
            onClick={() => setActiveTab('addProduct')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-md shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="bg-slate-950/95 border border-white/10 rounded-3xl p-5 text-white shadow-2xl shadow-slate-950/10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-violet-200">
                NOVA Showroom
              </div>
              <h3 className="mt-4 text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white">
                Discover brands, vendor drops and curated collections
              </h3>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                Explore the latest drops from verified partners and curate your next launch with confidence.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('products')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 transition"
            >
              <Sparkles className="w-4 h-4" />
              Explore Products
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-[1.5fr_0.8fr]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, vendors..."
                className="w-full rounded-3xl border border-white/15 bg-slate-900/80 py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-300/20"
              />
            </div>
            <button
              className="flex items-center justify-center gap-2 rounded-3xl border border-white/15 bg-white/5 px-4 py-4 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Our Vendors</h3>
            <button
              onClick={() => setActiveTab('products')}
              className="text-sm font-semibold text-primary hover:text-secondary transition"
            >
              View all
            </button>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex gap-4 min-w-max">
              {vendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => setActiveTab(vendor.id === 'all' ? 'dashboard' : 'products')}
                  className="min-w-[180px] rounded-3xl border border-slate-200/50 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                      <Package className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {vendor.id === 'all' ? 'All Vendors' : `${vendor.count} Products`}
                    </span>
                  </div>
                  <div className="mt-6 text-sm font-bold text-slate-900">
                    {vendor.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-slate-950/95 p-5 text-white shadow-lg shadow-slate-950/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Top Rated Products</h3>
            <button className="text-sm font-semibold text-violet-300 hover:text-violet-100">
              View all
            </button>
          </div>

          {topRatedProducts.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-sm text-slate-400">
              No top rated products available yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {topRatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/95 p-4 flex items-center gap-4"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-3xl bg-slate-800 shrink-0">
                    <img
                      src={product.imageUrl || product.mainImage || product.images?.[0] || ''}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-white truncate">{product.name}</h4>
                    <p className="text-[11px] text-slate-400">{product.brand}</p>
                    <p className="mt-2 text-sm font-bold text-slate-100">₹{product.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">Total Products</p>
          <h3 className="font-display text-3xl font-extrabold mt-1 text-slate-800">
            {totalProductsCount.toLocaleString()}
          </h3>
          <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-primary w-3/4 rounded-full"></div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+8%</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">Total Orders</p>
          <h3 className="font-display text-3xl font-extrabold mt-1 text-slate-800">
            {totalOrdersCount}
          </h3>
          <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-secondary w-1/2 rounded-full"></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+24%</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">Revenue</p>
          <h3 className="font-display text-3xl font-extrabold mt-1 text-slate-800">
            {formatRupeesCompact(calculatedRevenue)}
          </h3>
          <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-amber-500 w-2/3 rounded-full"></div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">-5%</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">Low Stock Alert</p>
          <h3 className="font-display text-3xl font-extrabold mt-1 text-slate-800">
            {lowStockCount}
          </h3>
          <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-rose-500 w-1/4 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Main Dashboard Layout Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Revenue Chart Area */}
        <div className="lg:col-span-8 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl p-6 flex flex-col relative h-[440px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-800">Revenue Trends</h3>
              <p className="text-xs font-medium text-slate-400">Growth comparison between core product categories</p>
            </div>
            <select 
              value={selectedRange} 
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer text-slate-600"
            >
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Quarter</option>
            </select>
          </div>

          {/* Line Chart Grid Lines and Paths */}
          <div className="flex-1 w-full relative group/chart mt-4">
            {/* Y axis lines */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between text-[10px] font-bold text-slate-300 pointer-events-none select-none z-0">
              <div className="border-b border-dashed border-slate-200/70 w-full pb-1 flex justify-between"><span>₹50k</span></div>
              <div className="border-b border-dashed border-slate-200/70 w-full pb-1 flex justify-between"><span>₹40k</span></div>
              <div className="border-b border-dashed border-slate-200/70 w-full pb-1 flex justify-between"><span>₹30k</span></div>
              <div className="border-b border-dashed border-slate-200/70 w-full pb-1 flex justify-between"><span>₹20k</span></div>
              <div className="border-b border-dashed border-slate-200/70 w-full pb-1 flex justify-between"><span>₹10k</span></div>
              <div className="flex justify-between"><span>0</span></div>
            </div>

            {/* SVGs rendering */}
            <svg className="absolute inset-0 w-full h-full overflow-visible z-10" viewBox="0 0 680 250" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#451ebb" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#451ebb" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              <path 
                d="M 40 220 Q 100 200 160 190 T 280 210 T 400 130 T 520 170 T 640 70 L 640 250 L 40 250 Z" 
                fill="url(#chartAreaGradient)"
                className="opacity-90"
              />

              {/* Anti-Reflective series line */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
                d="M 40 220 Q 100 200 160 190 T 280 210 T 400 130 T 520 170 T 640 70" 
                fill="none" 
                stroke="#451ebb" 
                strokeWidth="4" 
                strokeLinecap="round" 
              />

              {/* Polarized Coating series line */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
                d="M 40 240 Q 120 220 230 230 T 420 180 T 645 130" 
                fill="none" 
                stroke="#ab8ffe" 
                strokeWidth="2" 
                strokeDasharray="6 4" 
                strokeLinecap="round" 
              />

              {/* Hover nodes anchor buttons */}
              {points1.map((p, idx) => (
                <circle 
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="#ffffff"
                  stroke="#451ebb"
                  strokeWidth="3"
                  className="cursor-pointer hover:r-8 transition-all hover:fill-primary"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredDataPoint({
                      x: p.x,
                      y: p.y - 45,
                      label: p.label,
                      val1: p.val1,
                      val2: p.val2
                    });
                  }}
                  onMouseLeave={() => setHoveredDataPoint(null)}
                />
              ))}
            </svg>

            {/* Custom Tooltip on Hover */}
            {hoveredDataPoint && (
              <div 
                style={{ left: `${hoveredDataPoint.x - 50}px`, top: `${hoveredDataPoint.y}px` }}
                className="absolute z-20 bg-slate-900 text-white rounded-lg p-2 shadow-lg text-[10px] w-28 text-center border border-slate-700 pointer-events-none"
              >
                <div className="font-bold border-b border-slate-700 pb-1 mb-1">{hoveredDataPoint.label}</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Performance:</span>
                  <span className="font-bold text-accent">{hoveredDataPoint.val1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mix:</span>
                  <span className="font-bold text-secondary-fixed">{hoveredDataPoint.val2}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-8 mt-4 border-t border-slate-100 pt-4 select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
              <span>Electronics Focus</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="w-3.5 h-1.5 border border-dashed border-primary bg-secondary-container/40 rounded inline-block"></span>
              <span>Apparel Momentum</span>
            </div>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="lg:col-span-4 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl p-6 shrink-0 flex flex-col h-[440px]">
          <h3 className="font-display text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary" />
            <span>Recent Activity</span>
          </h3>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {activities.map((activity) => {
              // Map types to styles
              const getIconStyle = () => {
                switch(activity.type) {
                  case 'order': return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                  case 'inventory': return 'bg-cyan-50 text-cyan-600 border border-cyan-100';
                  case 'stock_alert': return 'bg-amber-50 text-amber-600 border border-amber-100';
                  case 'verification': return 'bg-purple-100/60 text-purple-600 border border-purple-200/40';
                  default: return 'bg-slate-50 text-slate-600 border border-slate-100';
                }
              };

              return (
                <div key={activity.id} className="flex gap-4 items-start hover:bg-slate-50/50 p-2 rounded-xl transition-all duration-200 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${getIconStyle()}`}>
                    {activity.type === 'order' && <CheckCircle className="w-5 h-5" />}
                    {activity.type === 'inventory' && <RotateCw className="w-5 h-5" />}
                    {activity.type === 'stock_alert' && <AlertTriangle className="w-5 h-5" />}
                    {activity.type === 'verification' && <User className="w-5 h-5" />}
                  </div>
                  <div className="truncate flex-1">
                    <h4 className="text-sm font-bold text-slate-700 truncate">{activity.title}</h4>
                    <p className="text-xs text-slate-400 font-semibold truncate mt-0.5">{activity.description}</p>
                    <span className="text-[10px] text-slate-300 font-bold block mt-1">{activity.time}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setShowActivityModal(true)}
            className="mt-6 text-primary font-bold text-xs hover:underline flex items-center justify-center gap-1 cursor-pointer w-full py-2 bg-slate-50 hover:bg-slate-120/50 rounded-xl"
          >
            <span>View All Activity</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bento Layout Second Row: Products & States */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top Products (Bento Card) */}
        <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl p-6 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display text-lg font-bold text-slate-800">Best Selling Models</h3>
            <span 
              onClick={() => {
                alert("Simulating standard Map location queries on connected partner networks across the globe.");
              }}
              className="text-primary text-xs font-bold hover:underline cursor-pointer"
            >
              Inventory Map
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 font-display text-[10px] uppercase font-bold border-b border-slate-100 pb-3 block md:table-row">
                  <th className="pb-3 md:pb-4">Model Name</th>
                  <th className="pb-3 md:pb-4">Product Type</th>
                  <th className="pb-3 md:pb-4">Sales</th>
                  <th className="pb-3 md:pb-4">Stock</th>
                  <th className="pb-3 md:pb-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {products.slice(0, 2).map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/40 transition-colors block md:table-row">
                    <td className="py-4 block md:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-0.5 overflow-hidden shadow-sm shrink-0">
                          <img className="w-full h-full object-cover rounded" src={product.imageUrl || product.mainImage || product.images?.[0] || ''} alt={product.name} referrerPolicy="no-referrer" />
                        </div>
                        <span className="font-bold text-slate-700 text-sm">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-xs font-semibold text-slate-500 block md:table-cell">
                      {product.id === 'titanium-edge-x1' ? 'Crystal AR' : 'Blue Guard'}
                    </td>
                    <td className="py-4 font-bold text-slate-700 text-xs block md:table-cell">
                      {product.id === 'titanium-edge-x1' ? '1,240' : '982'}
                    </td>
                    <td className="py-4 text-xs font-bold text-slate-500 block md:table-cell">
                      {product.stock}
                    </td>
                    <td className="py-4 text-right block md:table-cell">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        product.status === 'In Stock' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State / Market Insights Card - High Aesthetic Polish */}
        <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-secondary-fixed flex items-center justify-center animate-bounce shadow-md shadow-secondary-fixed/50" style={{ animationDuration: '3s' }}>
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h4 className="font-display text-base font-bold text-slate-700">Market Insights</h4>
            <p className="text-xs text-slate-400 font-medium max-w-[220px] mx-auto mt-1">
              Collecting data for your next AI-generated product suggestion...
            </p>
          </div>
          
          {/* Skeleton indicators */}
          <div className="w-full flex flex-col gap-2 opacity-40 select-none pointer-events-none">
            <div className="h-1.5 bg-slate-300 rounded-full w-4/5 mx-auto animate-pulse"></div>
            <div className="h-1.5 bg-slate-200 rounded-full w-2/3 mx-auto animate-pulse delay-75"></div>
          </div>
          
          <button 
            type="button"
            onClick={() => setShowInsightsModal(true)}
            className="text-primary hover:text-secondary font-bold text-xs select-none cursor-pointer border border-primary/20 hover:border-primary/50 bg-primary/5 px-4 py-1.5 rounded-full transition-all"
          >
            Coming Soon
          </button>
        </div>
      </div>

      {/* Loading Skeletons Section - Pending Shipments */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-bold text-slate-800">Pending Shipments</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none pointer-events-none">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/50 backdrop-blur-sm border border-slate-200/40 p-6 rounded-2xl animate-pulse">
              <div className="h-3.5 bg-slate-200 rounded-full w-1/3 mb-4"></div>
              <div className="h-7 bg-slate-200 rounded-full w-3/4 mb-5"></div>
              <div className="h-2 bg-slate-100 rounded-full w-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Modals for full interactiveness */}
      <AnimatePresence>
        {showActivityModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-2xl relative"
            >
              <h3 className="font-display text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">
                Supply Logs
              </h3>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-4 items-center">
                    <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-2 py-0.5 inline-block shrink-0">{a.time}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-700 truncate">{a.title}</div>
                      <div className="text-xs text-slate-400 truncate">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowActivityModal(false)}
                className="mt-6 w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-secondary cursor-pointer transition-colors"
              >
                Close Logs
              </button>
            </motion.div>
          </div>
        )}

        {showInsightsModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-2xl text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-800">
                AI Market Insights Module
              </h3>
              <p className="text-sm text-slate-500 max-w-[340px] mx-auto leading-relaxed">
                Our AI model is currently training on your client purchase history to generate customizable product recommendations matching local trends!
              </p>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 text-xs font-bold text-primary max-w-[360px] mx-auto">
                ✨ Suggested Style Next Week: A sleek hybrid collection of smart accessories and premium gear.
              </div>
              <button 
                onClick={() => setShowInsightsModal(false)}
                className="mt-4 w-full py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 cursor-pointer"
              >
                Got It, Thanks!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
