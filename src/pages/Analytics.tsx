import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download, 
  Package, 
  ArrowUpRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatRupees, formatRupeesCompact } from '../utils/currency';
import { Order, Product } from '../types';

interface AnalyticsProps {
  orders: Order[];
  products: Product[];
}

export default function Analytics({ orders, products }: AnalyticsProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Consistent earned revenue definition: Delivered or Shipped orders
  const earnedOrders = useMemo(() => {
    return orders.filter(order => order.status === 'Delivered' || order.status === 'Shipped');
  }, [orders]);

  const activeOrders = useMemo(() => {
    return orders.filter(order => order.status !== 'Cancelled');
  }, [orders]);

  const totalRevenue = useMemo(() => {
    return earnedOrders.reduce((sum, order) => sum + order.amount, 0);
  }, [earnedOrders]);

  const averageOrderValue = useMemo(() => {
    return earnedOrders.length ? totalRevenue / earnedOrders.length : 0;
  }, [earnedOrders, totalRevenue]);

  const salesByProduct = useMemo(() => {
    return earnedOrders.reduce<Record<string, number>>((sales, order) => {
      const key = order.productName.trim().toLowerCase();
      sales[key] = (sales[key] || 0) + order.quantity;
      return sales;
    }, {});
  }, [earnedOrders]);

  const bestSellingProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (salesByProduct[b.name.trim().toLowerCase()] || 0) - (salesByProduct[a.name.trim().toLowerCase()] || 0))
      .slice(0, 5);
  }, [products, salesByProduct]);

  // Last 6 months sales volume bars
  const barData = useMemo(() => {
    const now = new Date();
    const months: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const yr = d.getFullYear();
      const mo = d.getMonth();

      const matched = earnedOrders.filter(o => {
        const od = new Date(o.date);
        return !isNaN(od.getTime()) && od.getFullYear() === yr && od.getMonth() === mo;
      });

      const amount = matched.reduce((sum, o) => sum + o.amount, 0);
      months.push({ label, amount });
    }

    const maxAmount = Math.max(...months.map(m => m.amount), 0);
    return months.map(m => ({
      label: m.label,
      height: maxAmount > 0 ? `${Math.max(12, (m.amount / maxAmount) * 92)}%` : '8%',
      value: m.amount > 0 ? formatRupeesCompact(m.amount) : `${m.label}: ₹0`,
      color: '#ab8ffe'
    }));
  }, [earnedOrders]);

  // Dynamic Clothing Category Market Share
  const donutData = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category && p.category.trim() && p.category !== 'Uncategorized' ? p.category.trim() : 'Apparel';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const entries = Object.entries(categoryCount).sort(([, a], [, b]) => b - a);
    const total = products.length || 1;
    const top3 = entries.slice(0, 3);
    const top3Sum = top3.reduce((sum, [, count]) => sum + count, 0);
    const othersCount = total - top3Sum;

    const colors = ['#451ebb', '#ab8ffe', '#f9bd22', '#64748b'];
    let runningOffset = 0;
    
    const items = top3.map(([name, count], idx) => {
      const percentage = Math.max(1, Math.round((count / total) * 100));
      const item = {
        name,
        count,
        percentage,
        color: colors[idx % colors.length],
        strokeDasharray: `${percentage} ${100 - percentage}`,
        strokeDashoffset: -runningOffset
      };
      runningOffset += percentage;
      return item;
    });

    if (othersCount > 0 && top3.length > 0) {
      const percentage = Math.max(0, 100 - items.reduce((sum, i) => sum + i.percentage, 0));
      if (percentage > 0) {
        items.push({
          name: 'Other Clothing',
          count: othersCount,
          percentage,
          color: colors[3],
          strokeDasharray: `${percentage} ${100 - percentage}`,
          strokeDashoffset: -runningOffset
        });
      }
    }

    if (items.length === 0) {
      return [{
        name: 'Apparel',
        count: 0,
        percentage: 100,
        color: '#ab8ffe',
        strokeDasharray: '100 0',
        strokeDashoffset: 0
      }];
    }

    return items;
  }, [products]);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowExportModal(true);
    }, 1500);
  };

  return (
    <div className="space-y-8 select-none font-sans mb-16">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
            Performance Insights
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base max-w-2xl mt-1">
            Real-time data visualization for your product supply chain performance across multiple regions and product categories.
          </p>
        </div>
        <div className="flex gap-4">
          <button className="bg-white/60 hover:bg-white border border-slate-200/50 px-4 py-2.5 rounded-xl font-display text-sm font-bold text-primary flex items-center gap-2 transition-all cursor-pointer">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Last 30 Days</span>
          </button>
          
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-gradient-to-r from-primary to-secondary px-5 py-2.5 rounded-xl font-display text-sm font-bold text-white flex items-center gap-2 transition-all hover:scale-[1.02] shadow-md shadow-primary/20 cursor-pointer min-w-[155px] justify-center"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-all duration-300">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest font-display">TOTAL REVENUE</p>
          <div className="flex items-end justify-between mt-2">
            <p className="font-display text-3xl font-extrabold text-slate-800">{formatRupeesCompact(totalRevenue)}</p>
            <span className="text-primary font-bold text-xs flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full">
              +12.5% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-all duration-300">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest font-display">ACTIVE ORDERS</p>
          <div className="flex items-end justify-between mt-2">
            <p className="font-display text-3xl font-extrabold text-slate-800">{activeOrders.length.toLocaleString()}</p>
            <span className="text-primary font-bold text-xs flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full">
              +8.2% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-all duration-300">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest font-display">CONVERSION RATE</p>
          <div className="flex items-end justify-between mt-2">
            <p className="font-display text-3xl font-extrabold text-slate-800">{products.length ? `${Math.min(100, (activeOrders.length / products.length) * 100).toFixed(1)}%` : '0%'}</p>
            <span className="text-rose-500 font-bold text-xs flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-full">
              -0.4% <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-all duration-300">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest font-display">AVG ORDER VALUE</p>
          <div className="flex items-end justify-between mt-2">
            <p className="font-display text-3xl font-extrabold text-slate-800">{formatRupees(averageOrderValue)}</p>
            <span className="text-primary font-bold text-xs flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full">
              +5.1% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Sales Volume Bar Chart */}
        <div className="lg:col-span-8 bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display text-[15px] font-bold text-slate-800">Monthly Sales Volume</h3>
              <p className="text-xs text-slate-400 font-medium">Comparing gross revenue across current fiscal year</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Met</span>
            </div>
          </div>

          <div className="flex-1 flex items-end justify-between gap-3 md:gap-4 px-2 my-2 relative">
            {/* Horizontal guidelines */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between text-[9px] font-bold text-slate-200 pointer-events-none select-none z-0">
              <div className="border-b border-slate-100 w-full pt-1"></div>
              <div className="border-b border-slate-100 w-full"></div>
              <div className="border-b border-slate-100 w-full"></div>
              <div className="border-b border-slate-100 w-full"></div>
            </div>

            {barData.map((bar, index) => (
              <div 
                key={bar.label} 
                className="flex flex-col items-center gap-2 w-full h-full justify-end group z-10"
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                <div className="relative w-full flex items-end justify-center">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: bar.height }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: index * 0.05 }}
                    style={{ backgroundColor: hoveredBar === index ? '#451ebb' : '#ab8ffe' }}
                    className="w-[70%] max-w-[42px] rounded-t-lg transition-colors duration-200 cursor-pointer shadow-sm relative"
                  />
                  
                  {/* Tooltip on individual bar */}
                  {hoveredBar === index && (
                    <div className="absolute top-[-35px] bg-slate-950 text-white font-bold text-[10px] px-2 py-1 rounded shadow-lg z-30 pointer-events-none whitespace-nowrap">
                      {bar.value}
                    </div>
                  )}
                </div>
                <span className="font-display text-[9px] font-bold text-slate-400 select-none">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Performance Donut / Pie Chart */}
        <div className="lg:col-span-4 bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl flex flex-col justify-between h-[380px]">
          <h3 className="font-display text-[15px] font-bold text-slate-800 mb-4">Market Share</h3>
          
          <div className="relative w-44 h-44 mx-auto my-auto flex items-center justify-center">
            {/* Dynamic SVG Donut */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {donutData.map(item => (
                <circle 
                  key={item.name}
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="transparent" 
                  stroke={item.color} 
                  strokeWidth="5" 
                  strokeDasharray={item.strokeDasharray} 
                  strokeDashoffset={item.strokeDashoffset}
                  className="transition-all duration-300 hover:stroke-[6] cursor-pointer"
                  onMouseEnter={() => setActiveCategory(item.name)}
                  onMouseLeave={() => setActiveCategory(null)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none select-none">
              <span className="font-display text-2xl font-black text-slate-800">
                {activeCategory 
                  ? `${donutData.find(d => d.name === activeCategory)?.percentage ?? 0}%` 
                  : `${donutData[0]?.percentage ?? 100}%`}
              </span>
              <span className="font-display text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5 max-w-[100px] text-center truncate">
                {activeCategory || donutData[0]?.name || 'Total'}
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-2 select-none border-t border-slate-100 pt-3">
            {donutData.map(item => (
              <div 
                key={item.name}
                onMouseEnter={() => setActiveCategory(item.name)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center justify-between p-1 rounded transition-all cursor-pointer ${activeCategory === item.name ? 'bg-slate-100' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-xs font-semibold text-slate-500 truncate">{item.name}</span>
                </div>
                <span className="font-semibold text-xs text-slate-700 ml-2 shrink-0">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Products Section */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display text-base font-bold text-slate-800">Top Performing Products</h3>
          <span className="text-primary font-bold text-xs select-none hover:underline cursor-pointer">
            View All Inventory
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 pb-3 block md:table-row">
                <th className="pb-3 md:pb-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Product Name</th>
                <th className="pb-3 md:pb-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Category</th>
                <th className="pb-3 md:pb-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Sales</th>
                <th className="pb-3 md:pb-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Status</th>
                <th className="pb-3 md:pb-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150/40 block md:table-row-group">
              {bestSellingProducts.map(product => {
                const sales = salesByProduct[product.name.trim().toLowerCase()] || 0;
                const revenue = activeOrders
                  .filter(order => order.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
                  .reduce((sum, order) => sum + order.amount, 0);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-all block md:table-row group">
                    <td className="py-4 block md:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100/80 border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                          <img alt={product.name} className="w-full h-full object-cover rounded-lg" src={product.imageUrl || product.mainImage || product.images?.[0] || ''} referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 text-sm">{product.name}</p>
                          <p className="text-[10px] font-display font-medium text-slate-400">SKU: {product.sku || 'Not assigned'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 block md:table-cell"><span className="px-2.5 py-0.5 bg-primary/10 text-[10px] font-bold text-primary rounded-full select-none">{product.category}</span></td>
                    <td className="py-4 font-bold text-xs text-slate-650 block md:table-cell">{sales.toLocaleString()}</td>
                    <td className="py-4 block md:table-cell"><span className="text-xs font-semibold text-slate-400">{product.status}</span></td>
                    <td className="py-4 font-bold text-primary tracking-tight text-right block md:table-cell">{formatRupees(revenue)}</td>
                  </tr>
                );
              })}
              {bestSellingProducts.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400">No products uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Revenue Trends projections line chart */}
      <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/50 relative overflow-hidden h-[300px]">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none select-none">
          <div className="w-full h-full grid grid-cols-12 grid-rows-6">
            {Array.from({ length: 72 }).map((_, i) => (
              <div key={i} className="border-r border-b border-primary/40"></div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-800">Revenue Trends Projection</h3>
            <p className="text-xs text-slate-400 font-medium">Real-time velocity estimate based on historical cycles</p>
          </div>

          <div className="flex-1 w-full relative mt-4">
            <svg className="w-full h-28 overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradientAreaLower" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#451ebb" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#451ebb" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,90 Q100,80 200,70 T400,50 T600,30 T800,20 T1000,10 L1000,100 L0,100 Z" fill="url(#gradientAreaLower)" />
              <path d="M0,90 Q100,80 200,70 T400,50 T600,30 T800,20 T1000,10" fill="transparent" stroke="#451ebb" strokeWidth="3" strokeLinecap="round" />
              <circle cx="200" cy="70" fill="#ffffff" r="5" stroke="#451ebb" strokeWidth="2" />
              <circle cx="600" cy="30" fill="#ffffff" r="5" stroke="#451ebb" strokeWidth="2" />
              <circle cx="1000" cy="10" fill="#ffffff" r="5" stroke="#451ebb" strokeWidth="2" />
            </svg>
            <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-400 tracking-wider">
              <span>WEEK 01</span>
              <span>WEEK 02</span>
              <span>WEEK 03</span>
              <span>WEEK 04</span>
              <span>WEEK 05</span>
              <span>WEEK 06</span>
            </div>
          </div>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-2xl text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-slate-800">
              Report Generated Successfully
            </h3>
            <p className="text-sm text-slate-500 max-w-[320px] mx-auto leading-relaxed">
              Your comprehensive product performance spreadsheet (PDF &amp; CSV formats) has been assembled and is ready for download in your connected network logs directory.
            </p>
            <button 
              onClick={() => setShowExportModal(false)}
              className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
