import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { ProfileInfo } from '../types';

export interface VendorSignupData {
  companyName: string;
  ownerName: string;
  gstNumber: string;
  phoneNumber: string;
  businessAddress: string;
  logoUrl?: string;
}

export interface VendorRecord extends VendorSignupData {
  uid: string;
  email: string;
  vendorId: string;
  logoUrl: string;
  status: string;
  memberSince: string;
}

const VENDOR_ID_PREFIX = 'VEN';
const VENDOR_ID_DIGITS = 3;
const INITIAL_VENDOR_NUMBER = 5;
const vendorCounterRef = doc(db, 'metadata', 'vendors');

export const formatVendorId = (value: number) =>
  `${VENDOR_ID_PREFIX}${String(value).padStart(VENDOR_ID_DIGITS, '0')}`;

export const saveLocalVendorProfile = (uid: string, profile: ProfileInfo) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`nova-vendor-profile-${uid}`, JSON.stringify(profile));
      if (profile.vendorId) {
        window.localStorage.setItem(`nova-vendor-id-${profile.vendorId}`, JSON.stringify(profile));
      }
      window.localStorage.setItem('nova-last-vendor-profile', JSON.stringify(profile));
    }
  } catch {
    // Ignore storage quota or access errors
  }
};

export const getLocalVendorProfile = (uid?: string, email?: string): ProfileInfo | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    if (uid) {
      const byUid = window.localStorage.getItem(`nova-vendor-profile-${uid}`);
      if (byUid) {
        const parsed = JSON.parse(byUid);
        if (parsed && typeof parsed === 'object' && parsed.vendorId) {
          return parsed as ProfileInfo;
        }
      }
    }

    const last = window.localStorage.getItem('nova-last-vendor-profile');
    if (last) {
      const parsed = JSON.parse(last);
      if (parsed && typeof parsed === 'object' && parsed.vendorId) {
        if (!email || !parsed.email || parsed.email.toLowerCase() === email.toLowerCase()) {
          return parsed as ProfileInfo;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
};

export const getNextVendorId = async (): Promise<string> => {
  try {
    const counterSnapshot = await getDoc(vendorCounterRef);
    const counterNumber = counterSnapshot.exists() && Number.isFinite(Number(counterSnapshot.data().lastVendorNumber))
      ? Number(counterSnapshot.data().lastVendorNumber)
      : INITIAL_VENDOR_NUMBER;
    const nextNumber = Math.max(counterNumber, INITIAL_VENDOR_NUMBER) + 1;

    return formatVendorId(nextNumber);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not read vendor counter metadata doc, using fallback sequence', err);
    return formatVendorId((Date.now() % 900) + 100);
  }
};

export const buildProfileFromVendorDetails = (
  details: VendorSignupData & { vendorId: string }
): ProfileInfo => ({
  storeName: details.companyName,
  companyName: details.companyName,
  vendorId: details.vendorId,
  ownerName: details.ownerName,
  gstNumber: details.gstNumber,
  contactDetails: details.phoneNumber,
  businessAddress: details.businessAddress,
  logoUrl: details.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(details.companyName || 'Vendor')}&background=451ebb&color=fff&bold=true`,
  status: 'VERIFIED',
  memberSince: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })
});

export const createVendorProfile = async (
  uid: string,
  email: string,
  details: VendorSignupData
): Promise<ProfileInfo> => {
  const sanitizedDetails: VendorSignupData = {
    companyName: details.companyName.trim(),
    ownerName: details.ownerName.trim(),
    gstNumber: details.gstNumber.trim(),
    phoneNumber: details.phoneNumber.trim(),
    businessAddress: details.businessAddress.trim(),
    logoUrl: details.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(details.companyName || 'Vendor')}&background=451ebb&color=fff&bold=true`
  };

  try {
    const profile = await runTransaction(db, async transaction => {
      const counterSnapshot = await transaction.get(vendorCounterRef);
      const lastVendorNumber = counterSnapshot.exists()
        ? Number(counterSnapshot.data().lastVendorNumber) || INITIAL_VENDOR_NUMBER
        : INITIAL_VENDOR_NUMBER;
      const nextVendorNumber = Math.max(lastVendorNumber, INITIAL_VENDOR_NUMBER) + 1;
      const vendorId = formatVendorId(nextVendorNumber);
      const detailsWithId = { ...sanitizedDetails, vendorId };
      const builtProfile = buildProfileFromVendorDetails(detailsWithId);
      const vendorRecord: VendorRecord = {
        uid,
        email,
        ...sanitizedDetails,
        vendorId,
        logoUrl: builtProfile.logoUrl,
        status: builtProfile.status,
        memberSince: builtProfile.memberSince
      };

      const firestoreRecord = {
        ...vendorRecord,
        storeName: sanitizedDetails.companyName,
        contactDetails: sanitizedDetails.phoneNumber,
        location: sanitizedDetails.businessAddress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      transaction.set(vendorCounterRef, {
        lastVendorNumber: nextVendorNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
      transaction.set(doc(db, 'owner', uid), firestoreRecord, { merge: true });
      transaction.set(doc(db, 'vendors', vendorId), firestoreRecord, { merge: true });

      return builtProfile;
    });

    saveLocalVendorProfile(uid, profile);
    return profile;
  } catch (txError) {
    // eslint-disable-next-line no-console
    console.warn('Firestore transaction in createVendorProfile failed, using direct write fallback:', txError);

    const fallbackVendorNumber = (Date.now() % 900) + 100;
    const vendorId = formatVendorId(fallbackVendorNumber);
    const detailsWithId = { ...sanitizedDetails, vendorId };
    const profile = buildProfileFromVendorDetails(detailsWithId);
    const firestoreRecord = {
      uid,
      email,
      ...sanitizedDetails,
      vendorId,
      logoUrl: profile.logoUrl,
      status: profile.status,
      memberSince: profile.memberSince,
      storeName: sanitizedDetails.companyName,
      contactDetails: sanitizedDetails.phoneNumber,
      location: sanitizedDetails.businessAddress,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await Promise.all([
      setDoc(doc(db, 'owner', uid), firestoreRecord, { merge: true }),
      setDoc(doc(db, 'vendors', vendorId), firestoreRecord, { merge: true })
    ]);

    saveLocalVendorProfile(uid, profile);
    return profile;
  }
};

export const updateVendorProfile = async (
  uid: string,
  vendorId: string | undefined,
  profile: ProfileInfo
) => {
  const updates = {
    uid,
    storeName: profile.storeName,
    companyName: profile.companyName || profile.storeName,
    ownerName: profile.ownerName,
    gstNumber: profile.gstNumber,
    contactDetails: profile.contactDetails,
    phoneNumber: profile.contactDetails,
    businessAddress: profile.businessAddress,
    location: profile.businessAddress,
    logoUrl: profile.logoUrl,
    status: profile.status,
    memberSince: profile.memberSince,
    vendorId,
    updatedAt: serverTimestamp()
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'owner', uid), updates, { merge: true });
  if (vendorId) {
    batch.set(doc(db, 'vendors', vendorId), updates, { merge: true });
  }
  await batch.commit();

  saveLocalVendorProfile(uid, profile);
};
