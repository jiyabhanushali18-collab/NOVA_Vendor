import React, { useState } from 'react';
import {
  Info, 
  Image as ImageIcon, 
  Trash2, 
  IndianRupee, 
  Eye, 
  Boxes
} from 'lucide-react';
import { Product, ProductVariant } from '../types';

interface AddProductProps {
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  setActiveTab: (tab: string) => void;
  editingProduct?: Product | null;
  onUpdateProduct?: (product: Product) => Promise<void>;
}

const createVariantId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function AddProduct({ onAddProduct, setActiveTab, editingProduct, onUpdateProduct }: AddProductProps) {
  // Input fields status
  const [name, setName] = useState(editingProduct?.name || '');
  const [brand, setBrand] = useState(editingProduct?.brand || '');
  const [category, setCategory] = useState(editingProduct ? (editingProduct.category || 'Uncategorized') : 'T-Shirts');
  const fallbackColor = editingProduct?.color || '';
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [price, setPrice] = useState<number>(editingProduct?.price || 0);
  const [originalPrice, setOriginalPrice] = useState<number | ''>(editingProduct?.originalPrice ?? '');
  const [discountedPrice, setDiscountedPrice] = useState<number | ''>(editingProduct?.discountedPrice ?? '');
  const [stock, setStock] = useState<number>(editingProduct?.stock || 0);
  const [fabric, setFabric] = useState(editingProduct?.fabric || '');
  const [fit, setFit] = useState(editingProduct?.fit || '');
  const [occasion, setOccasion] = useState(editingProduct?.occasion || '');
  const [season, setSeason] = useState(editingProduct?.season || '');
  const [pattern, setPattern] = useState(editingProduct?.pattern || '');
  const [stretch, setStretch] = useState(editingProduct?.stretch || '');
  const [sleeveType, setSleeveType] = useState(editingProduct?.sleeveType || '');
  const [neckType, setNeckType] = useState(editingProduct?.neckType || '');
  const [careInstructions, setCareInstructions] = useState(editingProduct?.careInstructions || '');
  const [tags, setTags] = useState<string[]>(() => editingProduct?.tags?.slice() || []);
  const [tagInput, setTagInput] = useState('');
  const [gender, setGender] = useState(editingProduct?.gender || 'Unisex');
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (editingProduct?.variants && editingProduct.variants.length) {
      return editingProduct.variants.map(variant => ({
        ...variant,
        id: variant.id || createVariantId()
      }));
    }
    return [{
      id: createVariantId(),
      color: fallbackColor,
      images: editingProduct?.images?.length
        ? editingProduct.images
        : editingProduct?.imageUrl
          ? [editingProduct.imageUrl]
          : [],
      stock: editingProduct?.stock
    }];
  });
  const [imageFiles, setImageFiles] = useState<Record<string, File>>({});

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // face-shape compatibility removed for clothing / AR try-on

  const addVariant = () => {
    setVariants(prev => [...prev, { id: createVariantId(), color: '', sizes: [], images: [], stock: undefined }]);
  };

  const removeVariant = (variantId: string) => {
    setVariants(prev => prev.filter(variant => variant.id !== variantId));
  };

  const updateVariantColor = (variantId: string, colorVal: string) => {
    setVariants(prev => prev.map(variant => variant.id === variantId ? { ...variant, color: colorVal } : variant));
  };

  const updateVariantStock = (variantId: string, stockValue: string) => {
    setVariants(prev => prev.map(variant =>
      variant.id === variantId
        ? { ...variant, stock: stockValue === '' ? undefined : Math.max(0, Number(stockValue) || 0) }
        : variant
    ));
  };

  const updateVariantSizes = (variantId: string, size: string) => {
    setVariants(prev => prev.map(variant => {
      if (variant.id !== variantId) return variant;
      const sizes = variant.sizes ? [...variant.sizes] : [];
      if (sizes.includes(size)) {
        return { ...variant, sizes: sizes.filter(item => item !== size) };
      }
      return { ...variant, sizes: [...sizes, size] };
    }));
  };

  const updateVariantImages = (variantId: string, files: FileList | null) => {
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
    setVariants(prev => prev.map(variant => variant.id === variantId ? { ...variant, images: [...variant.images, ...urls] } : variant));
  };

  const removeVariantImage = (variantId: string, imgIndex: number) => {
    setVariants(prev => prev.map(variant => {
      if (variant.id !== variantId) return variant;
      const images = variant.images.filter((_, idx) => idx !== imgIndex);
      const removedUrl = variant.images[imgIndex];
      if (removedUrl) {
        setImageFiles(current => {
          const next = { ...current };
          delete next[removedUrl];
          return next;
        });
      }
      return { ...variant, images };
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

const normalizedVariants = (variants.length ? variants : [{ color: fallbackColor || 'Default', sizes: [], images: [], stock }])
      .map(variant => ({
        color: (variant.color || fallbackColor || 'Default').trim(),
        sizes: variant.sizes?.filter(Boolean) || [],
        images: [...variant.images],
        stock: variant.stock
      }));

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
      const savedVariants = await Promise.all(
        normalizedVariants.map(async variant => ({
          ...variant,
          images: await saveProductImages(variant.images, imageCache)
        }))
      );

      const primaryImage = savedVariants[0]?.images[0];
      if (!primaryImage) {
        throw new Error('Please upload at least one product image.');
      }

      const variantsWithImages = savedVariants.map(variant => ({
        color: variant.color.trim(),
        sizes: variant.sizes?.filter(Boolean) || [],
        images: variant.images,
        stock: variant.stock === undefined ? undefined : Math.max(0, Number(variant.stock) || 0)
      }));
      const productImages = [primaryImage];
      const variantColors = Array.from(new Set(
        variantsWithImages
          .map(variant => variant.color.trim())
          .filter(Boolean)
      ));
      const primaryColor = variantColors[0] || fallbackColor || 'Default';
      const enteredProductStock = Number(stock) || 0;
      const variantStockTotal = variantsWithImages.reduce((total, variant) => total + (variant.stock ?? 0), 0);
      const totalStock = enteredProductStock || variantStockTotal;

      const productPayload = {
        name,
        brand,
        category,
        fabric: fabric || undefined,
        fit: fit || undefined,
        gender,
        occasion: occasion || undefined,
        season: season || undefined,
        pattern: pattern || undefined,
        stretch: stretch || undefined,
        sleeveType: sleeveType || undefined,
        neckType: neckType || undefined,
        careInstructions: careInstructions.trim() || undefined,
        tags: tags.length ? tags : undefined,
        color: primaryColor,
        colors: variantColors.length ? variantColors : [primaryColor],
        description,
        price: Number(price) || 120,
        originalPrice: typeof originalPrice === 'number' ? originalPrice : undefined,
        discountedPrice: typeof discountedPrice === 'number' ? discountedPrice : undefined,
        stock: totalStock,
        status: totalStock > 15 ? 'In Stock' as const : totalStock > 0 ? 'Low Stock' as const : 'Out of Stock' as const,
        mainImage: primaryImage,
        imageUrl: primaryImage,
        images: productImages.length ? productImages : [primaryImage],
        sku: 'NV-' + Math.floor(1000 + Math.random() * 9000),
        variants: variantsWithImages,
      };

      if (editingProduct && onUpdateProduct) {
        await onUpdateProduct({
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
                <option>T-Shirts</option>
                <option>Shirts</option>
                <option>Polo Shirts</option>
                <option>Hoodies</option>
                <option>Sweatshirts</option>
                <option>Jackets</option>
                <option>Jeans</option>
                <option>Trousers</option>
                <option>Shorts</option>
                <option>Dresses</option>
                <option>Kurtis</option>
                <option>Sarees</option>
                <option>Co-ord Sets</option>
                <option>Crop Tops</option>
                <option>Skirts</option>
                <option>Blazers</option>
                <option>Ethnic Wear</option>
                <option>Footwear</option>
                <option>Bags</option>
                <option>Watches</option>
                <option>Sunglasses</option>
                <option>Caps</option>
                <option>Belts</option>
                <option>Jewellery</option>
                <option>Accessories</option>
              </select>
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
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">CATEGORY</label>
              <input
                readOnly
                value={category}
                className="bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">FABRIC</label>
              <select
                value={fabric}
                onChange={e => setFabric(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select fabric</option>
                <option>Cotton</option>
                <option>Organic Cotton</option>
                <option>Polyester</option>
                <option>Linen</option>
                <option>Rayon</option>
                <option>Denim</option>
                <option>Silk</option>
                <option>Wool</option>
                <option>Viscose</option>
                <option>Nylon</option>
                <option>Lycra</option>
                <option>Spandex</option>
                <option>Leather</option>
                <option>Faux Leather</option>
                <option>Blend</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">FIT</label>
              <select
                value={fit}
                onChange={e => setFit(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select fit</option>
                <option>Slim Fit</option>
                <option>Regular Fit</option>
                <option>Relaxed Fit</option>
                <option>Oversized</option>
                <option>Skinny</option>
                <option>Straight</option>
                <option>Loose</option>
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
                <option>Kids</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">OCCASION</label>
              <select
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select occasion</option>
                <option>Casual</option>
                <option>Formal</option>
                <option>Office</option>
                <option>Party</option>
                <option>Sports</option>
                <option>Ethnic</option>
                <option>Daily Wear</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">SEASON</label>
              <select
                value={season}
                onChange={e => setSeason(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select season</option>
                <option>Summer</option>
                <option>Winter</option>
                <option>Monsoon</option>
                <option>All Season</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">PATTERN</label>
              <select
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select pattern</option>
                <option>Solid</option>
                <option>Printed</option>
                <option>Graphic</option>
                <option>Checked</option>
                <option>Striped</option>
                <option>Floral</option>
                <option>Embroidered</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">STRETCH</label>
              <select
                value={stretch}
                onChange={e => setStretch(e.target.value)}
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">Select stretch</option>
                <option>Non Stretch</option>
                <option>Stretch</option>
                <option>Medium Stretch</option>
                <option>High Stretch</option>
              </select>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">SLEEVE TYPE</label>
                <select
                  value={sleeveType}
                  onChange={e => setSleeveType(e.target.value)}
                  className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="">Select sleeve type</option>
                  <option>Half Sleeve</option>
                  <option>Full Sleeve</option>
                  <option>Sleeveless</option>
                  <option>3/4 Sleeve</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">NECK TYPE</label>
                <select
                  value={neckType}
                  onChange={e => setNeckType(e.target.value)}
                  className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="">Select neck type</option>
                  <option>Round Neck</option>
                  <option>Crew Neck</option>
                  <option>V Neck</option>
                  <option>Polo</option>
                  <option>Mandarin</option>
                  <option>Hooded</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col gap-2">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">CARE INSTRUCTIONS</label>
              <textarea
                value={careInstructions}
                onChange={e => setCareInstructions(e.target.value)}
                rows={4}
                placeholder="e.g. Machine wash cold, do not bleach"
                className="bg-white/40 border border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl px-4 py-3 font-medium text-slate-705 outline-none transition-all duration-200 resize-none"
              />
            </div>
            <div className="md:col-span-3 flex flex-col gap-3">
              <label className="font-display text-xs font-bold text-slate-400 uppercase tracking-wider">TAGS</label>
              <div className="flex flex-wrap gap-2 items-center">
                {tags.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center gap-2">
                    {tag}
                    <button type="button" onClick={() => setTags(current => current.filter(item => item !== tag))} className="font-bold text-primary">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const next = tagInput.trim();
                      if (next && !tags.includes(next)) {
                        setTags(prev => [...prev, next]);
                      }
                      setTagInput('');
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  className="flex-1 bg-white/40 border border-primary/20 rounded-xl px-4 py-3 outline-none text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = tagInput.trim();
                    if (next && !tags.includes(next)) {
                      setTags(prev => [...prev, next]);
                    }
                    setTagInput('');
                  }}
                  className="px-4 py-3 bg-primary text-white rounded-xl font-semibold"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Variants (color -> multiple images) */}
        <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="w-5 h-5 text-primary" />
            <h2 className="font-display text-base font-bold text-slate-800">Variants (Color & Images)</h2>
          </div>

          <div className="space-y-4">
            {variants.map((v, idx) => (
              <div key={v.id || idx} className="border rounded-xl p-4">
                <div className="flex flex-col gap-3 mb-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                      type="text"
                      value={v.color}
                      onChange={e => updateVariantColor(v.id || '', e.target.value)}
                      placeholder="Color name (e.g. Black)"
                      className="flex-1 bg-white/40 border border-primary/20 rounded-xl px-4 py-2 outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.stock ?? ''}
                      onChange={e => updateVariantStock(v.id || '', e.target.value)}
                      placeholder="Variant stock"
                      className="w-full md:w-36 bg-white/40 border border-primary/20 rounded-xl px-4 py-2 outline-none"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Available Sizes</div>
                    <div className="flex flex-wrap gap-2">
                      {['XS','S','M','L','XL','XXL'].map(size => {
                        const active = v.sizes?.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => updateVariantSizes(v.id || '', size)}
                            className={`px-3 py-2 rounded-full border text-xs font-semibold transition-all ${active ? 'bg-primary text-white border-transparent' : 'bg-white/80 text-slate-700 border-slate-200 hover:border-primary'}`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-2 bg-primary/10 rounded cursor-pointer text-sm flex items-center gap-2">
                      Upload Images
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={e => updateVariantImages(v.id || '', e.target.files)}
                        className="hidden"
                      />
                    </label>
                    <button type="button" onClick={() => removeVariant(v.id || '')} className="px-3 py-2 bg-rose-50 rounded text-rose-600">Remove</button>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  {v.images && v.images.length ? v.images.map((img, i) => (
                    <div key={`${v.id || idx}-${i}`} className="w-24 h-24 bg-slate-100 rounded overflow-hidden relative">
                      <img src={img} alt={`variant-${idx}-${i}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeVariantImage(v.id || '', i)} className="absolute top-1 right-1 bg-black/40 text-white rounded-full p-1">×</button>
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
