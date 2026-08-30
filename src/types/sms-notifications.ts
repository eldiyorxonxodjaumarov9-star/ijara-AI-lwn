/** SMS xabarnoma turlari (keyingi Play Mobile integratsiyasi uchun) */
export interface SmsNotificationSettings {
  dueSoon: boolean;
  debtReminder: boolean;
  paymentReceived: boolean;
  general: boolean;
}

/** SMS bo‘limiga biriktirilgan yozuv (API / DB) */
export interface SmsLinkedTenant {
  id: string;
  tenantId: string;
  contractId?: string | null;
  propertyId?: string | null;
  /** Unique scope: contractId yoki "none" */
  scopeKey: string;
  fullName: string;
  phone: string;
  propertyLabel: string;
  smsEnabled: boolean;
  settings: SmsNotificationSettings;
  createdAt?: string;
}

/** Xabar tayyorlash draft */
export interface SmsComposeDraft {
  recipientIds: string[];
  message: string;
}

/** Arendator tanlash uchun ro‘yxat qatori (shartnoma/xona bo‘yicha) */
export interface SmsTenantCandidate {
  /** UI unique: tenantId:scopeKey */
  candidateKey: string;
  tenantId: string;
  contractId: string | null;
  propertyId: string | null;
  scopeKey: string;
  fullName: string;
  phone: string;
  propertyLabel: string;
  phoneValid: boolean;
  phoneInvalidReason?: string;
  alreadyLinked: boolean;
}
