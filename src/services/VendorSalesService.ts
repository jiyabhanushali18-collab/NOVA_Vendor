import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';

export type VendorSalesRange = 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'All Time';

export interface VendorSalesProduct {
  productId: string;
  productName: string;
  imageUrl: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

const dateDaysAgoUtc = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const mapSalesProduct = (id: string, data: DocumentData): VendorSalesProduct => ({
  productId: String(data.productId || id),
  productName: typeof data.productName === 'string' ? data.productName : 'Product',
  imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
  unitsSold: Number(data.unitsSold) || 0,
  orderCount: Number(data.orderCount) || 0,
  revenue: Number(data.revenue) || 0
});

export const subscribeToVendorSales = (
  vendorId: string,
  range: VendorSalesRange,
  onSales: (products: VendorSalesProduct[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!vendorId.trim()) {
    onError(new Error('Your vendor profile does not have a vendor ID.'));
    return () => undefined;
  }

  const salesCollection = range === 'All Time'
    ? collection(db, 'vendorSales', vendorId, 'products')
    : collection(db, 'vendorSales', vendorId, 'dailyProducts');
  const salesQuery = range === 'All Time'
    ? query(salesCollection, orderBy('unitsSold', 'desc'))
    : query(
      salesCollection,
      where('date', '>=', range === 'Today' ? todayUtc() : dateDaysAgoUtc(range === 'Last 7 Days' ? 6 : 29)),
      where('date', '<=', todayUtc())
    );

  return onSnapshot(
    salesQuery,
    snapshot => {
      if (range === 'All Time') {
        onSales(snapshot.docs.map(document => mapSalesProduct(document.id, document.data())));
        return;
      }

      const grouped = new Map<string, VendorSalesProduct>();
      snapshot.docs.forEach(document => {
        const product = mapSalesProduct(document.id, document.data());
        const existing = grouped.get(product.productId);
        grouped.set(product.productId, {
          ...product,
          unitsSold: product.unitsSold + (existing?.unitsSold || 0),
          orderCount: product.orderCount + (existing?.orderCount || 0),
          revenue: product.revenue + (existing?.revenue || 0)
        });
      });
      onSales(Array.from(grouped.values()).sort((a, b) => b.unitsSold - a.unitsSold));
    },
    error => {
      const firebaseError = error as Error & { code?: string };
      if (firebaseError.code === 'permission-denied') {
        onError(new Error(
          'Firebase blocked the sales read. Deploy firestore.rules to nova-26b39 and confirm your signed-in account is linked to this vendor ID in owner/{uid} or vendors/{vendorId}.'
        ));
        return;
      }
      onError(firebaseError);
    }
  );
};
