export type TelegramPostingStatus = "PENDING" | "SENDING" | "POSTED" | "FAILED";

export type TelegramChannelInput = {
  name: string;
  username?: string;
  chatId: string;
  enabled?: boolean;
  regionFilters?: string[];
  propertyTypeFilters?: string[];
  priority?: number;
};

export type TelegramChannelView = TelegramChannelInput & {
  id: string;
  isBotAdmin?: boolean | null;
  lastAdminCheckAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TelegramPostingJobView = {
  id: string;
  listingId: string;
  channelId: string;
  channelName: string;
  channelUsername?: string;
  status: TelegramPostingStatus;
  caption?: string;
  scheduledAt?: string;
  postedAt?: string;
  externalPostId?: string;
  postUrl?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
};

export type TelegramPostingLogView = {
  id: string;
  jobId: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type DistributeOptions = {
  scheduledAt?: string;
  immediate?: boolean;
};

export const TELEGRAM_STATUS_LABELS: Record<TelegramPostingStatus, string> = {
  PENDING: "Kutilmoqda",
  SENDING: "Yuborilmoqda",
  POSTED: "Joylandi",
  FAILED: "Xato",
};

export const TELEGRAM_STATUS_COLORS: Record<TelegramPostingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  SENDING: "bg-blue-100 text-blue-800 border-blue-300",
  POSTED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  FAILED: "bg-red-100 text-red-800 border-red-300",
};
