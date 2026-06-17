import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  // Skip if already small
  if (file.size < 200 * 1024) return file;
  
  return imageCompression(file, {
    maxSizeMB: 0.4,        // 400KB max
    maxWidthOrHeight: 1000,
    useWebWorker: true,
    fileType: 'image/webp', // webp is smaller than jpeg/png
  });
}