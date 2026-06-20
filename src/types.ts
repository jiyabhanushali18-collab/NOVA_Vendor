export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  description: string;
  imageUrl: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  frameShape?: string;
  material?: string;
  gender?: string;
  sku?: string;
  faceShapes?: string[];
}

export interface Order {
  id: string;
  customerName: string;
  customerInitials?: string;
  customerAvatar?: string;
  productName: string;
  quantity: number;
  amount: number;
  date: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
}

export interface Activity {
  id: string;
  type: 'order' | 'inventory' | 'stock_alert' | 'verification';
  title: string;
  description: string;
  time: string;
}

export interface ProfileInfo {
  storeName: string;
  ownerName: string;
  gstNumber: string;
  contactDetails: string;
  businessAddress: string;
  logoUrl: string;
  status: string;
  memberSince: string;
}
