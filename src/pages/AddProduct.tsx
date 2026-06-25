import React, { useState, useRef } from 'react';
import {
  Info, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Plus, 
  IndianRupee, 
  Eye, 
  AlertTriangle,
  Boxes,
  Activity,
  Heart
} from 'lucide-react';
import { Product, ProductVariant } from '../types';

interface AddProductProps {
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
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
  const [originalPrice, setOriginalPrice] = useState<number | ''>(editingProduct?.originalPrice ?? '');
  const [discountedPrice, setDiscountedPrice] = useState<number | ''>(editingProduct?.discountedPrice ?? '');
  const [stock, setStock] = useState<number>(editingProduct?.stock || 0);
  const [frameShape, setFrameShape] = useState(editingProduct?.frameShape || 'Standard');
  const [material, setMaterial] = useState(editingProduct?.material || 'Standard');
  const [gender, setGender] = useState(editingProduct?.gender || 'Unisex');
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (editingProduct?.variants && editingProduct.variants.length) return editingProduct.variants;
    return [{ color: editingProduct?.color || '', images: editingProduct?.imageUrl ? [editingProduct.imageUrl] : [] }];
  });
  const [mainImages, setMainImages] = useState<string[]>(() => {
    if (editingProduct?.variants && editingProduct.variants.length) {
      return editingProduct.variants[0].images || [];
    }
    return editingProduct?.imageUrl ? [editingProduct.imageUrl] : [];
  });
  const [imageFiles, setImageFiles] = useState<Record<string, File>>({});
  const mainInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // face-shape compatibility removed for clothing / AR try-on

  const addVariant = () => {
    setVariants(prev => [...prev, { color: '', images: [] }]);
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariantColor = (index: number, colorVal: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, color: colorVal } : v));
  };

  const updateVariantImages = (index: number, files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    const filesByPreviewUrl: Record<string, File> = {};
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = URL.createObjectURL(f);
      urls.push(url);
      filesByPreviewUrl[url] = f;
    }
    setImageFiles(prev => ({ ...prev, ...filesByPreviewUrl }));
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, images: [...v.images, ...urls] } : v));
  };

  const updateMainImages = (files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    const filesByPreviewUrl: Record<string, File> = {};
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = URL.createObjectURL(f);
      urls.push(url);
      filesByPreviewUrl[url] = f;
    }
    setImageFiles(prev => ({ ...prev, ...filesByPreviewUrl }));
    setMainImages(prev => [...prev, ...urls]);
    if (mainInputRef.current) {
      mainInputRef.current.value = '';
    }
  };

  const removeVariantImage = (vIndex: number, imgIndex: number) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== vIndex) return v;
      const images = v.images.filter((_, idx) => idx !== imgIndex);
      const removedUrl = v.images[imgIndex];
      if (removedUrl) {
        setImageFiles(current => {
          const next = { ...current };
          delete next[removedUrl];
          return next;
        });
      }
      return { ...v, images };
    }));
  };

  const readImageAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selected image.'));
      reader.readAsDataURL(file);
    });

  const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to prepare selected image.'));
      img.src = url;
    });

  const fileToCompressedDataUrl = async (file: File) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return readImageAsDataUrl(file);
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const img = await loadImage(objectUrl);
      const maxSize = 520;
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        return readImageAsDataUrl(file);
      }

      context.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.68);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const saveProductImage = async (previewUrl: string, imageCache: Map<string, Promise<string>>) => {
    if (imageCache.has(previewUrl)) {
      return imageCache.get(previewUrl)!;
    }

    const imagePromise = saveProductImageOnce(previewUrl);
    imageCache.set(previewUrl, imagePromise);
    return imagePromise;
  };

  const saveProductImageOnce = async (previewUrl: string) => {
    const file = imageFiles[previewUrl];

    if (!file) {
      if (previewUrl.startsWith('blob:')) {
        throw new Error('Selected image is no longer available. Please choose it again.');
      }

      return previewUrl;
    }

    return fileToCompressedDataUrl(file);
  };

  const saveProductImages = async (images: string[], imageCache: Map<string, Promise<string>>) => {
    const savedImages = await Promise.all(images.map(image => saveProductImage(image, imageCache)));
    return savedImages;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !brand) {
      alert("Please fill in the Product Name and Brand fields.");
      return;
    }

    const normalizedVariants = (variants.length ? variants : [{ color: color || 'Default', images: [] }])
      .map(variant => ({
        ...variant,
        color: variant.color || color || 'Default',
        images: [...variant.images]
      }));
    if (normalizedVariants.length && normalizedVariants[0].images.length === 0 && mainImages.length) {
      normalizedVariants[0].images = [...mainImages];
    }

    // validate variants: at least one variant and each must have >=1 image
    if (!normalizedVariants || normalizedVariants.length === 0) {
      alert('Please add at least one color variant with images.');
      return;
    }
    for (const v of normalizedVariants) {
      if (!v.color || v.images.length === 0) {
        alert('Each variant must have a color name and at least one image.');
        return;
      }
    }

    setSaving(true);

    try {
      const imageCache = new Map<string, Promise<string>>();
      const [savedMainImages, savedVariants] = await Promise.all([
        saveProductImages(mainImages, imageCache),
        Promise.all(
          normalizedVariants.map(async variant => ({
            ...variant,
            images: await saveProductImages(variant.images, imageCache)
          }))
        )
      ]);

      const primaryImage = savedMainImages[0] || savedVariants[0]?.images[0];
      if (!primaryImage) {
        throw new Error('Please upload at least one product image.');
      }

      const variantsWithImages = savedVariants.map(variant => ({
        ...variant,
        images: variant.images.length ? variant.images : [primaryImage]
      }));

      const productPayload = {
        name,
        brand,
        category,
        color,
        description,
        price: Number(price) || 120,
        originalPrice: typeof originalPrice === 'number' ? originalPrice : undefined,
        discountedPrice: typeof discountedPrice === 'number' ? discountedPrice : undefined,
        stock: Number(stock) || 50,
        status: (Number(stock) || 50) > 15 ? 'In Stock' as const : 'Low Stock' as const,
        imageUrl: primaryImage,
        frameShape,
        material,
        gender,
        sku: 'NV-' + Math.floor(1000 + Math.random() * 9000),
        variants: variantsWithImages,
      };

      if (editingProduct && onUpdateProduct) {
        onUpdateProduct({
          ...editingProduct,
          ...productPayload
        });
      } else {
        await onAddProduct(productPayload);
      }

      setSaving(false);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        setActiveTab('products');
      }, 1000);
    } catch (err) {
      console.error('Failed to save product', err);
      const message = err instanceof Error ? err.message : 'Unknown Firebase error';
      alert(`Unable to save product: ${message}`);
      setSaving(false);
    }
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
            <label className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-all">
              <Upload className="w-6 h-6 text-primary mb-2" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary/60">UPLOAD MAIN</span>
              <input
                ref={mainInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => updateMainImages(e.target.files)}
              />
            </label>

            {mainImages.length ? (
              mainImages.map((src, index) => (
                <div key={index} className="aspect-square rounded-2xl bg-slate-100/50 border border-slate-200 relative overflow-hidden group">
                  <img className="w-full h-full object-cover opacity-70 group-hover:scale-105 duration-300 rounded-2xl" src={src} alt={`main-${index}`} />
                      <button
                        type="button"
                        onClick={() => {
                          setMainImages(prev => prev.filter((_, i) => i !== index));
                          setImageFiles(current => {
                            const next = { ...current };
                            delete next[src];
                            return next;
                          });
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                      >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <>
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
                <div className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 flex items-center justify-center hover:bg-slate-50 duration-200">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Pricing and Stock */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pricing Card */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
            <div className="flex items-center gap-3 mb-6">
              <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <IndianRupee className="w-4 h-4" />
              </span>
              <h2 className="font-display text-base font-bold text-slate-800">Pricing</h2>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">Original Price (optional)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 transition-colors">₹</span>
                <input 
                  type="number"
                  value={originalPrice as any || ''}
                  onChange={e => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 5999"
                  className="bg-white/40 border border-primary/20 rounded-xl pl-8 pr-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">Discounted / Sale Price (optional)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 transition-colors">₹</span>
                <input 
                  type="number"
                  value={discountedPrice as any || ''}
                  onChange={e => setDiscountedPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 4999"
                  className="bg-white/40 border border-primary/20 rounded-xl pl-8 pr-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">Retail Price (INR)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 group-focus-within:text-primary transition-colors">₹</span>
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

          {/* Variants handled below */}
        </section>

        {/* Action bounds buttons footer */}
        
        {/* Variants (color -> multiple images) */}
        <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base font-bold text-slate-800">Variants (Color & Images)</h2>
          </div>

          <div className="space-y-4">
            {variants.map((v, idx) => (
              <div key={idx} className="border rounded-xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <input
                    type="text"
                    value={v.color}
                    onChange={e => updateVariantColor(idx, e.target.value)}
                    placeholder="Color name (e.g. Red)"
                    className="flex-1 bg-white/40 border border-primary/20 rounded-xl px-4 py-2 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 bg-primary/10 rounded cursor-pointer text-sm">
                      Upload Images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => updateVariantImages(idx, e.target.files)}
                        className="hidden"
                      />
                    </label>
                    <button type="button" onClick={() => removeVariant(idx)} className="px-3 py-2 bg-rose-50 rounded text-rose-600">Remove</button>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  {v.images && v.images.length ? v.images.map((img, i) => (
                    <div key={i} className="w-24 h-24 bg-slate-100 rounded overflow-hidden relative">
                      <img src={img} alt={`variant-${idx}-${i}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeVariantImage(idx, i)} className="absolute top-1 right-1 bg-black/40 text-white rounded-full p-1">×</button>
                    </div>
                  )) : (
                    <div className="text-sm text-slate-400">No images yet — upload at least one.</div>
                  )}
                </div>
              </div>
            ))}

            <div>
              <button type="button" onClick={addVariant} className="px-4 py-2 bg-white border rounded">Add Color Variant</button>
            </div>
          </div>
        </section>
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
