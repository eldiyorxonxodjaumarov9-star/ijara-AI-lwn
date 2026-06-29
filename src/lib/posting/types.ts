export const POSTING_PLATFORMS = [
  "ARENDA_INTERNAL",
  "TELEGRAM",
  "INSTAGRAM",
  "OLX",
  "JOYMEE",
  "EGASI",
  "BESTE",
] as const;

export type PostingPlatform = (typeof POSTING_PLATFORMS)[number];

export type PostingJobStatus =
  | "PENDING"
  | "POSTED"
  | "FAILED"
  | "MANUAL_REQUIRED";

export type ListingPostInput = {
  title: string;
  district: string;
  propertyType: string;
  rooms: number;
  area: number;
  price: number;
  description?: string;
  status: "active" | "draft" | "rented";
  images?: string[];
  landlordEmail: string;
  landlordName?: string;
  legacyLocalId?: string;
};

export type ManualPostingPackage = {
  platform: PostingPlatform;
  title: string;
  body: string;
  hashtags?: string;
  imageUrls: string[];
  tips: string;
};

export type PostingJobView = {
  id: string;
  platform: PostingPlatform;
  status: PostingJobStatus;
  generatedText?: string;
  manualPackage?: ManualPostingPackage;
  errorMessage?: string;
  retryCount: number;
  postedAt?: string;
  postUrl?: string;
  channelName?: string;
  externalPostId?: string;
};

export type PostingLogView = {
  id: string;
  jobId?: string;
  platform?: PostingPlatform;
  level: string;
  action?: string;
  message: string;
  createdAt: string;
};

export const JOB_STATUS_COLORS: Record<
  PostingJobStatus,
  string
> = {
  POSTED: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  PENDING: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  FAILED: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  MANUAL_REQUIRED: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
};

export type ListingWithJobs = {
  id: string;
  title: string;
  district: string;
  propertyType: string;
  rooms: number;
  area: number;
  price: number;
  description?: string;
  status: string;
  landlordEmail: string;
  legacyLocalId?: string;
  images: string[];
  jobs: PostingJobView[];
  createdAt: string;
};

export const PLATFORM_LABELS: Record<PostingPlatform, string> = {
  ARENDA_INTERNAL: "Arenda AI",
  TELEGRAM: "Telegram",
  INSTAGRAM: "Instagram",
  OLX: "OLX.uz",
  JOYMEE: "Joymee",
  EGASI: "egasi.uz",
  BESTE: "Beste",
};

export const JOB_STATUS_LABELS: Record<PostingJobStatus, string> = {
  PENDING: "Kutilmoqda",
  POSTED: "Joylandi",
  FAILED: "Xato",
  MANUAL_REQUIRED: "Qo'lda joylash",
};
