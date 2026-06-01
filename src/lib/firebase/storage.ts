import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { isFirebaseConfigured, storage } from "@/lib/firebase/config";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Rasmni yuklaydi. Firebase Storage sozlangan bo'lsa — bulutga,
 * aks holda demo uchun base64 data URL qaytaradi.
 */
export async function uploadImage(
  file: File,
  folder = "uploads"
): Promise<string> {
  if (isFirebaseConfigured && storage) {
    const path = `${folder}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
  return fileToDataUrl(file);
}
