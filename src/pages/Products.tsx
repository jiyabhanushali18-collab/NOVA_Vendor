import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  Zap, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Eye
} from 'lucide-react';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatRupees } from '../utils/currency';

interface ProductsProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setActiveTab: (tab: string) => void;
  onEditProduct?: (product: Product) => void;
  onSubmitReview?: (productId: string, payload: { rating: number; comment?: string; author?: string; arTryOn?: boolean; arRating?: number; }) => Promise<boolean>;
}

export default function Products({ products, setProducts, setActiveTab, onEditProduct, onSubmitReview }: ProductsProps) {
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('Status: All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Filter items reactively
  const filteredProducts = products.filter(product => {
    // Category check
    const matchesCategory = 
      selectedCategory === 'All Categories' || 
      product.category.toLowerCase() === selectedCategory.toLowerCase();

    // Status check
    let matchesStatus = true;
    if (selectedStatus === 'In Stock') {
      matchesStatus = product.status === 'In Stock';
    } else if (selectedStatus === 'Low Stock') {
      matchesStatus = product.status === 'Low Stock';
    } else if (selectedStatus === 'Out of Stock') {
      matchesStatus = product.status === 'Out of Stock';
    }

    // Search check
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Pagination bounds
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const [reviewModalProduct, setReviewModalProduct] = useState<Product | null>(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [arTryOn, setArTryOn] = useState(false);

  const openReviewModal = (p: Product) => {
    setReviewModalProduct(p);
    setNewRating(5);
    setNewComment('');
    setArTryOn(false);
  };

  const closeReviewModal = () => setReviewModalProduct(null);

  const submitReview = async () => {
    if (!reviewModalProduct) return;
    if (!onSubmitReview) {
      alert('Review submission not configured');
      return;
    }

    const success = await onSubmitReview(reviewModalProduct.id, {
      rating: newRating,
      comment: newComment,
      author: 'Vendor',
      arTryOn,
      arRating: arTryOn ? newRating : 0
    });

    if (success) {
      closeReviewModal();
    } else {
      alert('Failed to submit review');
    }
  };

  // Render ReviewModal inline so it has access to state vars
  const reviewModal = (
    <ReviewModal
      product={reviewModalProduct}
      rating={newRating}
      setRating={setNewRating}
      comment={newComment}
      setComment={setNewComment}
      arTryOn={arTryOn}
      setArTryOn={setArTryOn}
      onClose={closeReviewModal}
      onSubmit={submitReview}
    />
  );

  return (
    <>
    <div className="space-y-6 font-sans mb-16 select-none">
      {/* Search and Filters row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Category Filter */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 flex items-center px-4 py-2 rounded-xl gap-2 font-display">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option>All Categories</option>
              <option value="General">General</option>
              <option value="Electronics">Electronics</option>
              <option value="Accessories">Accessories</option>
              <option value="Apparel">Apparel</option>
              <option value="Sport">Sport</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 flex items-center px-4 py-2 rounded-xl gap-2 font-display">
            <Zap className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option>Status: All</option>
              <option>In Stock</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
            </select>
          </div>

          {/* Real-time search query container */}
          <div className="relative flex items-center bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-xl px-4 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search products..."
              className="bg-transparent text-xs font-semibold focus:outline-none text-slate-700 w-36 sm:w-48 placeholder-slate-400 outline-none border-none p-0"
            />
          </div>
        </div>

        {/* Add product button triggers react action context */}
        <button 
          onClick={() => setActiveTab('addProduct')}
          className="bg-gradient-to-r from-primary to-secondary text-white flex items-center gap-2 px-6 py-3 rounded-xl font-display font-bold text-sm hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Products table list card */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-primary/5 border-b border-slate-100">
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Product</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Category</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Price</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Stock</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Status</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => (
                    <motion.tr 
                      key={product.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.3 }}
                      className="hover:bg-white/40 transition-colors group"
                    >
                      {/* Product Thumbnail */}
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 shadow-sm p-0.5">
                            <img 
                              alt={product.name} 
                              className="w-full h-full object-cover rounded" 
                              src={product.imageUrl}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-slate-700 text-sm truncate">{product.name}</div>
                            <div className="text-xs text-slate-450 truncate font-semibold">{product.brand} {product.sku ? `(${product.sku})` : ''}</div>
                            <div className="text-xs text-amber-600 font-bold mt-1">{product.rating ? product.rating + ' ★' : 'No rating yet'} · {product.ratingCount ?? 0} reviews</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-5 text-sm font-semibold text-slate-500">
                        {product.category}
                      </td>

                      {/* Price */}
                      <td className="p-5 font-bold text-slate-700 text-sm">
                        {product.price > 0 ? (
                          formatRupees(product.price)
                        ) : (
                          <span className="text-rose-500">Price missing</span>
                        )}
                      </td>

                      {/* Stock units */}
                      <td className="p-5 text-xs text-slate-500 font-bold">
                        {product.stock} Units
                      </td>

                      {/* Status Badging */}
                      <td className="p-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          product.status === 'In Stock' 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-rose-50 text-rose-500'
                        }`}>
                          {product.status}
                        </span>
                      </td>

                      {/* Stateful delete/edit buttons */}
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button 
                            type="button"
                            onClick={() => {
                              if(onEditProduct) {
                                onEditProduct(product);
                              } else {
                                alert("Editing product details: " + product.name);
                              }
                            }}
                            className="p-1.5 hover:bg-primary/10 rounded-lg text-primary hover:text-secondary duration-150 cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewModal(product)}
                            className="p-1.5 hover:bg-primary/10 rounded-lg text-amber-600 duration-150 cursor-pointer"
                            title="Add Review"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-450 hover:text-rose-600 duration-150 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400 font-medium">
                      No products found matching the filters.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination element */}
        <div className="p-5 flex items-center justify-between border-t border-slate-100 bg-white/20">
          <p className="text-xs font-bold text-slate-400 font-display uppercase tracking-widest">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
          </p>
          <div className="flex gap-1.5 items-center">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 select-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl font-display font-extrabold text-xs transition-all cursor-pointer ${
                  currentPage === i + 1 
                    ? 'bg-primary text-white' 
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 select-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    {reviewModal}
    </>
  );
}

// Note: lightweight modal markup appended at file end to avoid large edits above

export function ReviewModal({
  product,
  rating,
  setRating,
  comment,
  setComment,
  arTryOn,
  setArTryOn,
  onClose,
  onSubmit
}: {
  product: Product | null;
  rating: number;
  setRating: (v: number) => void;
  comment: string;
  setComment: (s: string) => void;
  arTryOn: boolean;
  setArTryOn: (b: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-2xl p-6 z-10 w-[min(720px,95%)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Add review for {product.name}</h3>
          <button onClick={onClose} className="text-slate-500">Close</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold">Rating</label>
            <div className="flex items-center gap-2 mt-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} className={`px-3 py-1 rounded ${rating===n? 'bg-amber-300' : 'bg-slate-100'}`}>{n} ★</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold">Comment</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full mt-2 p-2 border rounded" />
          </div>

          <div className="flex items-center gap-3">
            <input id="arTry" type="checkbox" checked={arTryOn} onChange={e => setArTryOn(e.target.checked)} />
            <label htmlFor="arTry" className="text-sm">Rate AR try-on experience</label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded">Cancel</button>
            <button onClick={onSubmit} className="px-4 py-2 bg-primary text-white rounded">Submit Review</button>
          </div>
        </div>
      </div>
    </div>
  );
}
