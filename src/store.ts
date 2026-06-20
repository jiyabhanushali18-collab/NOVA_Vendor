import { Product, Order, Activity, ProfileInfo } from './types';

export const initialProducts: Product[] = [
  {
    id: 'titanium-edge-x1',
    name: 'Titanium Edge X1',
    brand: 'Nova Optics',
    category: 'Luxury Aviators',
    price: 185.00,
    stock: 450,
    color: 'Sleek Silver',
    description: 'A sleek pair of modern titanium eyeglasses with a minimalist silver frame and anti-reflective lenses. The glasses are crafted in a lightweight material and offer extreme durability and comfort.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAROr2ehHgAsWyqikChT6fcEywOSxxxNK5j7Yf1lrnJ2uiwmZLBrSTsO-gmN6nlrU07rtusufu_PYjqPrDYUoNADV26mIAFdd_16zGLFYLAUM4Iqip_93clb_-0-3bKj3MlXR4jeng8cHEqteBrEacGjFXRi3EkPGY8WAgh2d1BuDwgaCEoSCwfUygs-61L7-tEFV1JbzwRpdQBLiKGIRK-Lzyrr2h1efCh_Bx-YBSv4vRqvZ68w9LadHieG6kVA4SIxMyDMOrhUKk',
    status: 'In Stock',
    frameShape: 'Aviator',
    material: 'Titanium',
    gender: 'Unisex',
    sku: 'NV-8829',
    faceShapes: ['Oval', 'Heart']
  },
  {
    id: 'classic-acetate-dark',
    name: 'Classic Acetate Dark',
    brand: 'Nova Optics',
    category: 'Blue Light',
    price: 145.00,
    stock: 22,
    color: 'Tortoise Shell',
    description: 'A pair of premium dark acetate rectangular eyeglasses with subtle tortoise shell patterns. Specially engineered with Blue Guard filter for extended digital display usage.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABhph-FHv2nJoFbamC_4d263hQHkQj_H3Cmd5_IgHjm5L6Ky2X3gvCXxzxB7SyrpeI2uP8a6U5fOKezq11cq-CJq9jJ974swvmEY8D_U12WzdQOFvyNS7Xnl7amu5BUSGNPbiHoPVv6XdILgXI52hv7AUitbjT2pHxMGT0wjGSBi4EUvZghMzgQV4mEOF8bEKROdqvSnCnJO2wAWc4eI43DUitUKE78ws3pPbEJjOjLGSaCYDpv_DiGcmWhwaIdDMMyNKgWIcvF8A',
    status: 'Low Stock',
    frameShape: 'Rectangular',
    material: 'Acetate',
    gender: 'Unisex',
    sku: 'NV-3310',
    faceShapes: ['Round', 'Oval', 'Heart']
  },
  {
    id: 'ray-ban-aviators',
    name: 'Ray-Ban Aviators',
    brand: 'Ray-Ban',
    category: 'Luxury Aviators',
    price: 185.00,
    stock: 124,
    color: 'Classic Gold',
    description: 'A high-end product showcasing classic gold-rimmed aviator sunglasses. High definition crystal lenses offering absolute UV protection and surgical premium frame glint.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO8dNctqi0O4hiy2Dyw2xF2XHM81fsJ54k_e5mTHZ29sY4jv4LxoX5gLoyUanryk2bcyUVgR_fvm5y8XJzd0qnJ7CUzrsiajUMHDTRcECzRYroMq3L8wJBFtoTWAbaiW9qRUE6Hbpbk6JC5rEUqZW2Nb2dG4LxXmqZYdET8IHLUkhjvKiUHdEN2eIbaJKB0Oktls6HbAtAV7NFUAbpolEwZZIYGXNk6o2ThdvGE8ZvKIQEX0q6WVgl9o084ZyT7abUvJA9jOigSd8',
    status: 'In Stock',
    frameShape: 'Aviator',
    material: 'Stainless Steel',
    gender: 'Unisex',
    sku: 'RB-0912',
    faceShapes: ['Square', 'Oval']
  },
  {
    id: 'digital-clarity-plus',
    name: 'Digital Clarity Plus',
    brand: 'Nova Optics',
    category: 'Blue Light',
    price: 45.50,
    stock: 8,
    color: 'Transparent Clear',
    description: 'Sleek, modern blue light blocking glasses with transparent frames. Crafted in premium bio-resin with high optical clarity design.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1gv7GCFFNqRDnQ87rhK7RPSOP_X_i8F7C2hWNft7W11Bw20xLQ7r7PH07_i4jhTgGUuxDTUqr4GyJjLXGA9Vnj7wyTdn5K8_XTwzfknEdr9aR34oc7v9F1r5IljSimOhFqxNX1IQsE18lUjuo0Mn42Lcmi5HnZBiOKwMISdxKVZN4c1E2RUfaMv8ciSSrgeeKMRtEqwbGoQW9n70mQ7DcZsg9Ke1M5mwd2W5aiQypot3nN9H7sBH_Ol7KNcdHD1lLMCRyC01maao',
    status: 'Low Stock',
    frameShape: 'Round',
    material: 'Bio-Resin',
    gender: 'Unisex',
    sku: 'NV-5512',
    faceShapes: ['Square', 'Diamond']
  },
  {
    id: 'onyx-night-shades',
    name: 'Onyx Night Shades',
    brand: 'Onyx',
    category: 'Luxury Aviators',
    price: 290.00,
    stock: 42,
    color: 'Deep Obsidian',
    description: 'Deep black, oversized luxury sunglasses. High fashion profile and directional styling, with dramatic highlights and silver core accents.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVF_jwupRutoNQ5XESTkuj2MBKjD8xrQboq4KljZAzWRu1RYgBcgzaWHRnfbnNED84BWuzvX51QuY-UcUIllNWSF1bnLGCRILBhBTmrPAuzd4wDVeSQWSYJ5r4QRDPxf8kIlq4An0W0hD3IQX_eL03W1pExJEHYBVWRogtrZADlOJGWEJdKNQuxD_STVIjPDeymgWucP4MCkzRItZruuB3KZd-KeUNS4nwumw4eqWqXGa6hJKMcA_o4HQsWEDOoybBeu96ccOmnjg',
    status: 'In Stock',
    frameShape: 'Geometric',
    material: 'Acetate',
    gender: 'Men',
    sku: 'OX-9821',
    faceShapes: ['Round', 'Oval']
  },
  {
    id: 'active-fit-sport',
    name: 'Active Fit Sport',
    brand: 'Nova Optics',
    category: 'Sport',
    price: 110.00,
    stock: 310,
    color: 'Polarized Orange',
    description: 'Durable, lightweight athletic wrap-around sunglasses featuring polarized orange lenses. High speed visual performance and bio-resin frame technology.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2GzO_z9lj2Z7BYp0vZTCuD7bxnzHJ_jDYiQlENiObzclejpfK3yj9S5idxbQzqZaUflDZb4k2715Hl7gP294gAkj1P2oodG6yzrAWFuzgR3-aE4BLneRsf8aSeCzXK2RYDJJh4Yfazlvl7496zHnZaPqD6UhUvQaFYawJQPI_hRp-5Qk_KSGrwOui79lGIvgd5Dx3_1o1EloMOyWSgntM-3auzV4knmohYhAkmtlCgpy1UFz1D73PNrn9MNP7adZJqevRPtJDBvk',
    status: 'In Stock',
    frameShape: 'Rectangular',
    material: 'Bio-Resin',
    gender: 'Unisex',
    sku: 'NV-9921',
    faceShapes: ['Oval', 'Diamond', 'Heart']
  }
];

export const initialOrders: Order[] = [
  {
    id: '#NV-8829',
    customerName: 'Elena Kovacs',
    customerInitials: 'EK',
    productName: 'Prism Lens X14',
    quantity: 2,
    amount: 1240.00,
    date: 'Oct 24, 2023',
    status: 'Pending'
  },
  {
    id: '#NV-8830',
    customerName: 'Julian Moore',
    customerInitials: 'JM',
    productName: 'Optic Core Pro',
    quantity: 1,
    amount: 3450.00,
    date: 'Oct 24, 2023',
    status: 'Shipped'
  },
  {
    id: '#NV-8831',
    customerName: 'David Chen',
    customerAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoWMlWET7ntSeMRm9ZRydXWgdXN2WcdyHPaV08CGW7o0JIX-S81VsMNuGk_tXjWglUCqqaPaKnasWpl4gRhEp80jL3GCTTsAfGHLhKjoklkuX1byvTtVNHzghYqTuiSGrNL8xBXnzAUUSa2S0ub2uvjG5u5cGJXsYbijvI4zkdMf9JMZmSazstRRgyjZfbk6etsIxxsNX0N9UDp_HudQvLXjTg2_6Ly1ijzDKS5Tc3JI6ywqCXCLAP_59XjsM3-W6CNoc8z4cCy6o',
    productName: 'Lidar Module v2',
    quantity: 5,
    amount: 820.50,
    date: 'Oct 23, 2023',
    status: 'Delivered'
  },
  {
    id: '#NV-8832',
    customerName: 'Sarah Bloom',
    customerInitials: 'SB',
    productName: 'Refraction Kit',
    quantity: 1,
    amount: 145.00,
    date: 'Oct 22, 2023',
    status: 'Cancelled'
  },
  {
    id: '#NV-8833',
    customerName: 'Thomas Reed',
    customerInitials: 'TR',
    productName: 'Nova Glass Filter',
    quantity: 12,
    amount: 2890.00,
    date: 'Oct 22, 2023',
    status: 'Shipped'
  }
];

export const initialActivities: Activity[] = [
  {
    id: 'act-1',
    type: 'order',
    title: 'New Order #4829',
    description: 'Aviator Titanium Frame (x24)',
    time: '2 minutes ago'
  },
  {
    id: 'act-2',
    type: 'inventory',
    title: 'Inventory Updated',
    description: 'Blue Light Blocking Lens (+100)',
    time: '45 minutes ago'
  },
  {
    id: 'act-3',
    type: 'stock_alert',
    title: 'Stock Alert',
    description: 'Rimless Classic Gold (Low Stock)',
    time: '3 hours ago'
  },
  {
    id: 'act-4',
    type: 'verification',
    title: 'Account Verification',
    description: 'Tax documents approved',
    time: '5 hours ago'
  }
];

export const initialProfile: ProfileInfo = {
  storeName: 'NOVA Optics Global',
  ownerName: 'Alexander Vance',
  gstNumber: 'GSTIN29ABCDE1234F1Z5',
  contactDetails: '+1 (555) 012-3456',
  businessAddress: '724 Optical Plaza, Suite 900, Silicon Forest, Oregon, 97005, USA',
  logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBm7eQXshyPhi-B1Ro7Zq36moMoPn2a4rmSYwA2w1fKa1nqsP0MRghkW4gcGRGt9GKK8IR9hwCFhp8Q96E_OPYKUhsL-j29Fx81vCKhCF_TrFbhKRBG-iIUGKFerL3bMSASFCzgEJesWMh817QYGDnJgxdYrUHjQScSD20Nwe7A00OkkFtU2PAcjrQP2LD6PO9HgBC3AbJ6ACbp2JSx8mXJrxDbm-8QFlj4O0WTPWtcdCWLaj_ST4jLO70cXxu_sgDTqsX1YxRh2hg',
  status: 'VERIFIED',
  memberSince: 'Jan 2024'
};
