import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot
} from 'firebase/storage';
import { storage } from '../firebase';

const compressLogo = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not process the selected logo image.'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Could not process the selected logo image.'));
            return;
          }
          resolve(blob);
        }, 'image/webp', 0.82);
      };
      image.onerror = () => reject(new Error('Could not read the selected logo image.'));
      image.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Could not read the selected logo image.'));
    reader.readAsDataURL(file);
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not prepare the compressed logo image.'));
    reader.readAsDataURL(blob);
  });

export const uploadVendorLogo = async (
  file: File,
  vendorKey: string
): Promise<string> => {
  const compressedLogo = await compressLogo(file);
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const logoRef = ref(storage, `vendor-logos/${vendorKey}/${Date.now()}-${safeName}`);

  try {
    const uploadResult = await new Promise<UploadTaskSnapshot>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(logoRef, compressedLogo, {
        contentType: compressedLogo.type
      });
      const timeoutId = window.setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Logo upload timed out.'));
      }, 15000);

      uploadTask.on(
        'state_changed',
        undefined,
        error => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
        () => {
          window.clearTimeout(timeoutId);
          resolve(uploadTask.snapshot);
        }
      );
    });
    return await getDownloadURL(uploadResult.ref);
  } catch (error) {
    console.warn('Firebase Storage logo upload failed; using a compressed Firestore-storable image.', error);
    const dataUrl = await blobToDataUrl(compressedLogo);
    if (dataUrl.length > 700 * 1024) {
      throw new Error('This logo is too detailed to save. Choose a smaller or simpler image.');
    }
    return dataUrl;
  }
};
