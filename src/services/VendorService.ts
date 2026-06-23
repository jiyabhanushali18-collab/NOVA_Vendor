import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import { ProfileInfo } from '../types';

export interface VendorSignupData {
  companyName: string;
  ownerName: string;
  gstNumber: string;
  phoneNumber: string;
  businessAddress: string;
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
const vendorCounterRef = doc(db, 'metadata', 'vendors');

const readString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const readVendorNumber = (value: unknown) => {
  const match = readString(value).match(/^VEN(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const formatVendorId = (value: number) =>
  `${VENDOR_ID_PREFIX}${String(value).padStart(VENDOR_ID_DIGITS, '0')}`;

const highestVendorNumber = (docs: DocumentData[]) =>
  docs.reduce((highest, data) => Math.max(highest, readVendorNumber(data.vendorId)), 0);

export const getNextVendorId = async () => {
  const ownersSnapshot = await getDocs(collection(db, 'owner'));
  const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
  const counterSnapshot = await getDoc(vendorCounterRef);
  const ownerDocs = ownersSnapshot.docs.map(snapshot => snapshot.data());
  const vendorDocs = vendorsSnapshot.docs.map(snapshot => snapshot.data());
  const counterNumber = counterSnapshot.exists()
    ? Number(counterSnapshot.data().lastVendorNumber) || 0
    : 0;
  const nextNumber = Math.max(counterNumber, highestVendorNumber([...ownerDocs, ...vendorDocs])) + 1;

  return formatVendorId(nextNumber);
};

const getCurrentHighestVendorNumber = async () => {
  const ownersSnapshot = await getDocs(collection(db, 'owner'));
  const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
  const ownerDocs = ownersSnapshot.docs.map(snapshot => snapshot.data());
  const vendorDocs = vendorsSnapshot.docs.map(snapshot => snapshot.data());

  return highestVendorNumber([...ownerDocs, ...vendorDocs]);
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
  logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(details.companyName)}&background=451ebb&color=fff&bold=true`,
  status: 'PENDING',
  memberSince: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })
});

export const createVendorProfile = async (
  uid: string,
  email: string,
  details: VendorSignupData
) => {
  const existingHighestVendorNumber = await getCurrentHighestVendorNumber();
  return runTransaction(db, async transaction => {
    const counterSnapshot = await transaction.get(vendorCounterRef);
    const lastVendorNumber = counterSnapshot.exists()
      ? Number(counterSnapshot.data().lastVendorNumber) || 0
      : existingHighestVendorNumber;
    const nextVendorNumber = Math.max(lastVendorNumber, existingHighestVendorNumber) + 1;
    const vendorId = formatVendorId(nextVendorNumber);
    const detailsWithId = { ...details, vendorId };
    const profile = buildProfileFromVendorDetails(detailsWithId);
    const vendorRecord: VendorRecord = {
      uid,
      email,
      ...details,
      vendorId,
      logoUrl: profile.logoUrl,
      status: profile.status,
      memberSince: profile.memberSince
    };

    const firestoreRecord = {
      ...vendorRecord,
      storeName: details.companyName,
      contactDetails: details.phoneNumber,
      location: details.businessAddress,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(vendorCounterRef, {
      lastVendorNumber: nextVendorNumber,
      updatedAt: serverTimestamp()
    }, { merge: true });
    transaction.set(doc(db, 'owner', uid), firestoreRecord);
    transaction.set(doc(db, 'vendors', vendorId), firestoreRecord);

    return profile;
  });
};

export const updateVendorProfile = async (
  uid: string,
  vendorId: string | undefined,
  profile: ProfileInfo
) => {
  const updates = {
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

  await Promise.all([
    setDoc(doc(db, 'owner', uid), updates, { merge: true }),
    vendorId
      ? setDoc(doc(db, 'vendors', vendorId), updates, { merge: true })
      : Promise.resolve()
  ]);
};
