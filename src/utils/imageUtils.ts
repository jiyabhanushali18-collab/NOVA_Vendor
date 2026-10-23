import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Converts a file to a compressed base64 data URL.
 * Scales large images down so that neither dimension exceeds maxDimension (default 320px),
 * and compresses using JPEG/PNG quality.
 */
export const fileToCompressedDataUrl = async (
  file: File,
  maxDimension: number = 320,
  quality: number = 0.75
): Promise<string> => {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const origWidth = img.naturalWidth || img.width || 1;
          const origHeight = img.naturalHeight || img.height || 1;
          const scale = Math.min(1, maxDimension / Math.max(origWidth, origHeight));
          const width = Math.max(1, Math.round(origWidth * scale));
          const height = Math.max(1, Math.round(origHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(String(reader.result || ''));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch {
          resolve(String(reader.result || ''));
        }
      };
      img.onerror = () => resolve(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

/**
 * Resilient logo uploader.
 * First tries uploading to Firebase Storage with a 4000ms timeout.
 * If Firebase Storage fails or times out (e.g. CORS, permissions, spark tier),
 * falls back to a compressed Base64 data URL so account creation / saving is never blocked.
 */
export const uploadVendorLogo = async (
  file: File,
  vendorKey: string,
  fallbackName?: string
): Promise<string> => {
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const logoRef = ref(storage, `vendor-logos/${vendorKey}/${Date.now()}-${safeName}`);

  try {
    const uploadResult = await Promise.race([
      uploadBytes(logoRef, file),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Logo upload timed out')), 4000);
      })
    ]);

    return await getDownloadURL(uploadResult.ref);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Firebase Storage upload failed or timed out. Falling back to compressed data URL.', err);
    try {
      const compressed = await fileToCompressedDataUrl(file, 320, 0.75);
      if (compressed) {
        return compressed;
      }
    } catch (compressErr) {
      // eslint-disable-next-line no-console
      console.warn('Compression fallback failed, using UI avatar.', compressErr);
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'Vendor')}&background=451ebb&color=fff&bold=true`;
  }
};
