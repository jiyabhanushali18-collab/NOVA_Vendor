import React, { useState } from 'react';
import { 
  Download, 
  Plus, 
  Calendar, 
  Search, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp, 
  Package, 
  Clock,
  Sparkles,
  CheckCircle,
  Truck,
  RotateCw,
  User,
  Trash2
} from 'lucide-react';
import { Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatRupees, formatRupeesCompact } from '../utils/currency';

interface OrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export default function Orders({ orders, setOrders }: OrdersProps) {
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [channelFilter, setChannelFilter] = useState('All Channels');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  
  // New order form fields state
  const [customerName, setCustomerName] = useState('');
  const [productName, setProductName] = useState('Prism Core X14');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(120);

  const itemsPerPage = 5;

  // Filter reactively
  const filteredOrders = orders.filter(order => {
    const matchesStatus = 
      statusFilter === 'All Statuses' || 
      order.status === statusFilter;

    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) return;

    const getInitials = (name: string) => {
      const parts = name.split(' ');
      return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
    };

    const newOrder: Order = {
      id: '#NV-' + Math.floor(8834 + Math.random() * 1000),
      customerName,
      customerInitials: getInitials(customerName),
      productName,
      quantity,
      amount,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Pending'
    };

    setOrders(prev => [newOrder, ...prev]);
    setShowNewOrderModal(false);
    setCustomerName('');
    setQuantity(1);
    setAmount(120);
    setCurrentPage(1);
  };

  const handleStatusChange = (orderId: string, nextStatus: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled') => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
  };

  const handleDeleteOrder = (orderId: string) => {
    if (confirm("Are you sure you want to remove this order?")) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  return (
    <div className="space-y-6 font-sans mb-16 select-none animate-fadeIn">
      {/* Page Heading & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
            Order Management
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
            View and process your customer transactions through our precision analytics.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              alert("Exporting transaction list as standard-compliant CSV format to downloads directory.");
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/60 border border-slate-200/50 text-primary font-display text-sm font-bold rounded-xl hover:bg-white/90 cursor-pointer transition-all shrink-0"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>
          
          <button 
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-secondary text-white font-display text-sm font-bold rounded-xl shadow-md hover:scale-[1.02] cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Dashboard Filters Panel */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 rounded-2xl flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 font-display tracking-wider mb-2 uppercase">STATUS FILTER</label>
          <select 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white/40 border border-primary/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-xs font-semibold text-slate-600 outline-none cursor-pointer"
          >
            <option>All Statuses</option>
            <option>Pending</option>
            <option>Shipped</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 font-display tracking-wider mb-2 uppercase">DATE RANGE</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              className="w-full pl-10 bg-white/40 border border-primary/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-xs font-semibold text-slate-600 outline-none" 
              type="text" 
              value="Last 30 Days"
              readOnly
            />
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 font-display tracking-wider mb-2 uppercase">CHANNEL</label>
          <select 
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full bg-white/40 border border-primary/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-xs font-semibold text-slate-600 outline-none cursor-pointer"
          >
            <option>All Channels</option>
            <option>Direct Store</option>
            <option>Marketplace</option>
            <option>API Partner</option>
          </select>
        </div>

        {/* Search tool block */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 font-display tracking-wider mb-2 uppercase">SEARCH SEARCH</label>
          <div className="relative flex items-center bg-white/40 border border-primary/10 rounded-xl px-3.5 py-2 focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ID, customer..."
              className="bg-transparent border-none text-xs font-semibold text-slate-700 placeholder-slate-450 focus:outline-none w-full outline-none p-0"
            />
          </div>
        </div>
      </div>

      {/* Main Order Table Container */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 select-none">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Customer Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 font-display uppercase tracking-wider text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              <AnimatePresence mode="popLayout">
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => {
                    const getStatusColor = (status: string) => {
                      switch(status) {
                        case 'Pending': return 'bg-amber-100 text-amber-800 border border-amber-200/80';
                        case 'Shipped': return 'bg-secondary-fixed text-on-secondary-fixed-variant border border-secondary-fixed-dim/40';
                        case 'Delivered': return 'bg-slate-100 text-slate-700 border border-slate-200';
                        case 'Cancelled': return 'bg-rose-100 text-rose-800 border border-rose-200/80';
                        default: return 'bg-slate-100 text-slate-500';
                      }
                    };

                    return (
                      <motion.tr 
                        key={order.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.25 }}
                        className="hover:bg-white/50 transition-all duration-300 relative group"
                      >
                        <td className="px-6 py-4.5 font-display font-bold text-primary text-sm">
                          {order.id}
                        </td>
                        <td className="px-6 py-4.5">
                          <div className="flex items-center gap-3">
                            {order.customerAvatar ? (
                              <div className="w-8 h-8 rounded-full border border-primary/20 overflow-hidden shadow-sm shrink-0">
                                <img src={order.customerAvatar} alt={order.customerName} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-secondary-container/40 text-primary-container font-extrabold text-xs flex items-center justify-center shrink-0 border border-secondary-container/70 shadow-sm">
                                {order.customerInitials || 'Customer'}
                              </div>
                            )}
                            <span className="font-bold text-slate-700 text-xs truncate max-w-[130px]">{order.customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-slate-500 font-semibold text-xs truncate max-w-[150px]">
                          {order.productName}
                        </td>
                        <td className="px-6 py-4.5 text-slate-400 font-extrabold text-xs">
                          {order.quantity} {order.quantity === 1 ? 'Unit' : 'Units'}
                        </td>
                        <td className="px-6 py-4.5 font-bold text-slate-800 text-xs">
                          {formatRupees(order.amount)}
                        </td>
                        <td className="px-6 py-4.5 text-slate-400 font-bold text-xs whitespace-nowrap">
                          {order.date}
                        </td>
                        <td className="px-6 py-4.5">
                          {/* Status Select dropdown inside cell for supreme craftsmanship! */}
                          <div className="relative inline-block">
                            <select 
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                              className={`px-3 py-1 bg-white hover:bg-slate-100 rounded-full text-[9px] font-bold tracking-wider uppercase transition-colors outline-none cursor-pointer border select-none appearance-none`}
                              style={{ 
                                outline: 'none',
                                borderColor: order.status === 'Pending' ? '#f59e0b' : order.status === 'Shipped' ? '#ab8ffe' : order.status === 'Delivered' ? '#94a3b8' : '#f43f5e',
                                color: order.status === 'Pending' ? '#b45309' : order.status === 'Shipped' ? '#4f319c' : order.status === 'Delivered' ? '#334155' : '#be123c'
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex md:opacity-0 group-hover:opacity-100 transition-opacity gap-1 justify-end select-none">
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-1 hover:bg-rose-50 text-rose-450 hover:text-rose-600 rounded-lg cursor-pointer"
                              title="Delete log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400 font-medium">
                      No customer orders found matching the filter logs query.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination element block */}
        <div className="px-6 py-4 bg-slate-50/30 flex items-center justify-between border-t border-slate-100 select-none">
          <span className="text-xs font-bold text-slate-400 font-display uppercase tracking-widest">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
          </span>
          <div className="flex items-center gap-1.5 font-display font-extrabold">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-45 cursor-pointer text-slate-650"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs transition-colors shrink-0 cursor-pointer ${
                  currentPage === i + 1 
                    ? 'bg-primary text-white font-bold' 
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-45 cursor-pointer text-slate-650"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contextual Stats Bento Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Net volume */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl relative overflow-hidden flex flex-col group border border-slate-200/50">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none"></div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-primary/5 text-primary border border-primary/10 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-primary font-bold text-xs bg-primary/5 px-2 py-0.5 rounded-full">+12.5%</span>
          </div>
          <h3 className="text-slate-400 font-bold font-display text-[10px] mb-1 uppercase tracking-widest leading-none">Net Volume</h3>
          <p className="font-display text-3xl font-extrabold text-primary">{formatRupeesCompact(42800)}</p>
        </div>

        {/* Stat Active shipments */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl relative overflow-hidden flex flex-col group border border-slate-200/50">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-all pointer-events-none"></div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-secondary/5 text-secondary border border-secondary/10 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-secondary font-bold text-xs bg-secondary/5 px-2 py-0.5 rounded-full">+3.2%</span>
          </div>
          <h3 className="text-slate-400 font-bold font-display text-[10px] mb-1 uppercase tracking-widest leading-none">Active Shipments</h3>
          <p className="font-display text-3xl font-extrabold text-slate-800">156</p>
        </div>

        {/* Stat Avg processing */}
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl relative overflow-hidden flex flex-col group border border-slate-200/50">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none"></div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-amber-500/5 text-amber-550 border border-amber-500/10 rounded-xl">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-full">-0.4h</span>
          </div>
          <h3 className="text-slate-400 font-bold font-display text-[10px] mb-1 uppercase tracking-widest leading-none">Avg Processing</h3>
          <p className="font-display text-3xl font-extrabold text-slate-800">4.2h</p>
        </div>
      </section>

      {/* New Order Overlay Form Dialog */}
      <AnimatePresence>
        {showNewOrderModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-2xl relative"
            >
              <h3 className="font-display text-base font-bold text-slate-805 border-b border-slate-100 pb-3 mb-4">
                Record New Customer Order
              </h3>
              
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer Name</label>
                  <input 
                    type="text" 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Elena Kovacs"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl h-11 px-3 text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Product Selection</label>
                  <select 
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl h-11 px-3 text-sm font-semibold focus:outline-none focus:border-primary outline-none cursor-pointer"
                  >
                    <option>Prism Core X14</option>
                    <option>Nova Core Pro</option>
                    <option>Lidar Module v2</option>
                    <option>Refraction Kit</option>
                    <option>Nova Power Filter</option>
                    <option>Eclipse Prime</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quantity</label>
                    <input 
                      type="number" 
                      min={1}
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl h-11 px-3 text-sm font-semibold focus:outline-none focus:border-primary transition-all outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Amount (₹)</label>
                    <input 
                      type="number" 
                      min={1}
                      value={amount}
                      onChange={e => setAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl h-11 px-3 text-sm font-semibold focus:outline-none focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowNewOrderModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-primary to-secondary rounded-xl hover:brightness-110 shadow-lg shadow-primary/10 transition-all cursor-pointer"
                  >
                    Save Order
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
