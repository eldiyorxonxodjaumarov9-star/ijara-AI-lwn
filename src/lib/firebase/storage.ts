import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { isFirebaseConfigured, storage } from "@/lib/firebase/config";
import { apiFetch, API_URL, isApiConfigured } from "@/lib/api/client";

function toAbsolute(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//.test(url) || url.startsWith("data:")) return url;
  if (!API_URL) return url;
  // To'liq (http://host:port/api) bo'lsa — static fayllar origin orqali beriladi.
  // Nisbiy (/api) bo'lsa — frontend bilan bir origin, URL allaqachon to'g'ri.
  if (/^https?:\/\//.test(API_URL)) {
    try {
      return `${new URL(API_URL).origin}${url}`;
    } catch {
      return url;
    }
  }
  return url;
}

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
  if (isApiConfigured) {
    const form = new FormData();
    form.append("files", file);
    const res = await apiFetch<{ urls: string[] }>("/uploads", {
      method: "POST",
      isForm: true,
      body: form,
    });
    return toAbsolute(res.urls?.[0] ?? "");
  }
  if (isFirebaseConfigured && storage) {
    const path = `${folder}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
  return fileToDataUrl(file);
}
