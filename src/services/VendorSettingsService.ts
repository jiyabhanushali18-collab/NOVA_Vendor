import { doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export interface VendorNotificationPreferences {
  orderAlerts: boolean;
  stockWarnings: boolean;
}

export const DEFAULT_VENDOR_NOTIFICATION_PREFERENCES: VendorNotificationPreferences = {
  orderAlerts: true,
  stockWarnings: true
};

const preferencesRef = (uid: string) => doc(db, 'owner', uid);

export const subscribeToVendorNotificationPreferences = (
  uid: string,
  onPreferences: (preferences: VendorNotificationPreferences) => void,
  onError: (error: Error) => void
): Unsubscribe => onSnapshot(
  preferencesRef(uid),
  snapshot => {
    const data = snapshot.data()?.notificationPreferences;
    onPreferences({
      orderAlerts: typeof data?.orderAlerts === 'boolean'
        ? data.orderAlerts
        : DEFAULT_VENDOR_NOTIFICATION_PREFERENCES.orderAlerts,
      stockWarnings: typeof data?.stockWarnings === 'boolean'
        ? data.stockWarnings
        : DEFAULT_VENDOR_NOTIFICATION_PREFERENCES.stockWarnings
    });
  },
  onError
);

export const updateVendorNotificationPreference = (
  uid: string,
  preference: keyof VendorNotificationPreferences,
  enabled: boolean
) => updateDoc(preferencesRef(uid), {
  [`notificationPreferences.${preference}`]: enabled
});
