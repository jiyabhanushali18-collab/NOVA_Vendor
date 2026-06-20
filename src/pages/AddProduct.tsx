import React, { useState } from 'react';
import { 
  Info, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Plus, 
  DollarSign, 
  Eye, 
  AlertTriangle,
  Boxes,
  Activity,
  Heart
} from 'lucide-react';
import { Product } from '../types';

interface AddProductProps {
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  setActiveTab: (tab: string) => void;
  editingProduct?: Product | null;
  onUpdateProduct?: (product: Product) => void;
}

export default function AddProduct({ onAddProduct, setActiveTab, editingProduct, onUpdateProduct }: AddProductProps) {
  // Input fields status
  const [name, setName] = useState(editingProduct?.name || '');
  const [brand, setBrand] = useState(editingProduct?.brand || '');
  const [category, setCategory] = useState(editingProduct?.category || 'General');
  const [color, setColor] = useState(editingProduct?.color || '');
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [price, setPrice] = useState<number>(editingProduct?.price || 0);
  const [stock, setStock] = useState<number>(editingProduct?.stock || 0);
  const [frameShape, setFrameShape] = useState(editingProduct?.frameShape || 'Standard');
  const [material, setMaterial] = useState(editingProduct?.material || 'Standard');
  const [gender, setGender] = useState(editingProduct?.gender || 'Unisex');
  const [selectedFaceShapes, setSelectedFaceShapes] = useState<string[]>(
    editingProduct?.faceShapes || ['Square', 'Heart']
  );

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const faceShapesOpts = ['Oval', 'Square', 'Round', 'Heart', 'Diamond'];

  const toggleFaceShape = (shape: string) => {
    setSelectedFaceShapes(prev => 
      prev.includes(shape) ? prev.filter(s => s !== shape) : [...prev, shape]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !brand) {
      alert("Please fill in the Product Name and Brand fields.");
      return;
    }

    setSaving(true);

    const mockupGlintImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtMVlsRWdEW-pFyEO3U1hZmeAx-sIK5aHnPNfHs_ZxVKxYrdHeeO6AGJ0hEtLf_KoVgfJrVpTlZVgDQrt1LjKsjQUehidZvRfhmKVHgPdVgWzkXuFrMkzJoNy6k4qO2ZfPi6LWdLyjSVqmJ_dJSiL71zLrSKeRrhJj13a1z7pJNMXclUgouUPHH-EvRZwzKVUK8tAOEMnn3SdZ4R3SzcmdNSEbHQT5RkQj57Xs7gTe7HX7f7mongL_TZ8uuH8bOOQFICSz6GjyGp0';

    setTimeout(() => {
      setSaving(false);
      setSuccess(true);

      const productPayload = {
        name,
        brand,
        category,
        color,
        description,
        price: Number(price) || 120,
        stock: Number(stock) || 50,
        status: (Number(stock) || 50) > 15 ? 'In Stock' as const : 'Low Stock' as const,
        imageUrl: mockupGlintImage,
        frameShape,
        material,
        gender,
        sku: 'NV-' + Math.floor(1000 + Math.random() * 9000),
        faceShapes: selectedFaceShapes
      };

      if (editingProduct && onUpdateProduct) {
        onUpdateProduct({
          ...editingProduct,
          ...productPayload
        });
      } else {
        onAddProduct(productPayload);
      }

      setTimeout(() => {
        setSuccess(false);
        setActiveTab('products');
      }, 1000);
    }, 1500);
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-32 select-none font-sans">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Information Section */}
        <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base font-bold text-slate-800">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">PRODUCT NAME</label>
              <input 
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Aeon Crystal Clear"
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">BRAND</label>
              <input 
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. Nova Supply"
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">CATEGORY</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option>General</option>
                <option>Electronics</option>
                <option>Accessories</option>
                <option>Apparel</option>
                <option>Home</option>
                <option>Sport</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">COLOR</label>
              <input 
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="e.g. Gradient Indigo"
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">DESCRIPTION</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the aesthetic and functional details of the product..."
                rows={4}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 resize-none"
              />
            </div>
          </div>
        </section>

        {/* Product Media */}
        <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base font-bold text-slate-800">Product Media</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Upload Main placeholder */}
            <div className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-all">
              <Upload className="w-6 h-6 text-primary mb-2" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary/60">UPLOAD MAIN</span>
            </div>

            {/* Existing mock asset image 2 */}
            <div className="aspect-square rounded-2xl bg-slate-100/50 border border-slate-200 relative overflow-hidden group">
              <img 
                className="w-full h-full object-cover opacity-70 group-hover:scale-105 duration-300 rounded-2xl" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtMVlsRWdEW-pFyEO3U1hZmeAx-sIK5aHnPNfHs_ZxVKxYrdHeeO6AGJ0hEtLf_KoVgfJrVpTlZVgDQrt1LjKsjQUehidZvRfhmKVHgPdVgWzkXuFrMkzJoNy6k4qO2ZfPi6LWdLyjSVqmJ_dJSiL71zLrSKeRrhJj13a1z7pJNMXclUgouUPHH-EvRZwzKVUK8tAOEMnn3SdZ4R3SzcmdNSEbHQT5RkQj57Xs7gTe7HX7f7mongL_TZ8uuH8bOOQFICSz6GjyGp0" 
                alt="Product sample 2" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                <Trash2 className="w-5 h-5 text-red-500 hover:scale-110 transition-transform" />
              </div>
            </div>

            {/* Existing mock asset image 3 */}
            <div className="aspect-square rounded-2xl bg-slate-100/50 border border-slate-200 relative overflow-hidden group">
              <img 
                className="w-full h-full object-cover opacity-70 group-hover:scale-105 duration-300 rounded-2xl" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuASB6mwCD-qC-PscxNz6BcA3TcYiQVfEBYXySBdUr7hq6LKxrttnUJ3z2WiBPId19N9UaZSLQGZ7Afv00M6WSjOrwRNPljqyogBprzm6kOUnhTF3coKQmaJNOQIsyXLc4rEvTaWeeHd5fEvZ39Zzo6PjiPE2KppVNT91IVztocbWpN_e-T4g1PQZJI3g5e_zxapnzhKRJWptO0IGyri9dfl5HSly3QiKEGQsZT5ydN3hKEJkY7ycMJwEhVSpCxCrTnw9W6tZGBZ3Lc" 
                alt="Product sample 3" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                <Trash2 className="w-5 h-5 text-red-500 hover:scale-110 transition-transform" />
              </div>
            </div>

            {/* Dash placeholder plus */}
            <div className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 duration-200">
              <Plus className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </section>

        {/* Pricing and Stock */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pricing Card */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
            <div className="flex items-center gap-3 mb-6">
              <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <DollarSign className="w-4 h-4" />
              </span>
              <h2 className="font-display text-base font-bold text-slate-800">Pricing</h2>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">RETAIL PRICE (USD)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 group-focus-within:text-primary transition-colors">$</span>
                <input 
                  type="number"
                  value={price || ''}
                  onChange={e => setPrice(Number(e.target.value))}
                  placeholder="0.00"
                  className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl pl-8 pr-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 w-full"
                />
              </div>
            </div>
          </div>

          {/* Stock Card */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
            <div className="flex items-center gap-3 mb-6">
              <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <Boxes className="w-4 h-4" />
              </span>
              <h2 className="font-display text-base font-bold text-slate-800">Stock</h2>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">AVAILABLE UNITS</label>
              <input 
                type="number"
                value={stock || ''}
                onChange={e => setStock(Number(e.target.value))}
                placeholder="e.g. 50"
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 w-full"
              />
            </div>
          </div>
        </section>

        {/* Product Attributes */}
        <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base font-bold text-slate-800">Product Specifications</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">ITEM STYLE</label>
              <select
                value={frameShape}
                onChange={e => setFrameShape(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option>Standard</option>
                <option>Modern</option>
                <option>Sport</option>
                <option>Minimal</option>
                <option>Premium</option>
                <option>Performance</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">MATERIAL</label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option>Acetate</option>
                <option>Titanium</option>
                <option>Stainless Steel</option>
                <option>Carbon Fiber</option>
                <option>Bio-Resin</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">GENDER</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option>Unisex</option>
                <option>Men</option>
                <option>Women</option>
              </select>
            </div>
          </div>

          <div className="mt-8">
            <label className="font-display text-xs font-bold text-slate-400 block mb-4 uppercase tracking-wider">
              FACE SHAPE COMPATIBILITY
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {faceShapesOpts.map((shape) => {
                const isSelected = selectedFaceShapes.includes(shape);
                return (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => toggleFaceShape(shape)}
                    className={`p-4 rounded-xl text-xs font-semibold cursor-pointer border hover:translate-y-[-1px] transition-all text-center ${
                      isSelected
                        ? 'bg-primary/10 text-primary border-primary'
                        : 'bg-white/40 hover:bg-white/60 text-slate-500 border-slate-200/50'
                    }`}
                  >
                    <span>{shape}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Action bounds buttons footer */}
        <div className="flex items-center justify-end gap-4 pt-6">
          <button 
            type="button"
            onClick={() => setActiveTab('products')}
            className="px-8 py-3 rounded-full font-display font-bold border border-slate-300 text-slate-650 hover:bg-slate-100 active:scale-95 transition-all text-sm cursor-pointer"
          >
            Discard
          </button>
          
          <button 
            type="submit"
            disabled={saving || success}
            className={`px-12 py-3 rounded-full font-display font-bold text-white shadow-lg transition-all text-sm cursor-pointer flex items-center gap-3 ${
              success 
                ? 'bg-emerald-500 shadow-emerald-500/10'
                : 'bg-gradient-to-r from-primary to-secondary hover:brightness-110 active:scale-95 shadow-primary/10'
            }`}
          >
            <span>
              {saving ? 'Saving...' : success ? 'Product Saved!' : editingProduct ? 'Update Product' : 'Save Product'}
            </span>
            {saving && (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
