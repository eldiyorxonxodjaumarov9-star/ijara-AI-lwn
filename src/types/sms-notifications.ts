/** SMS xabarnoma turlari (keyingi Play Mobile integratsiyasi uchun) */
export interface SmsNotificationSettings {
  dueSoon: boolean;
  debtReminder: boolean;
  paymentReceived: boolean;
  general: boolean;
}

/** UI: biriktirilgan arendator (vaqtinchalik state) */
export interface SmsLinkedTenant {
  tenantId: string;
  fullName: string;
  phone: string;
  propertyLabel: string;
  smsEnabled: boolean;
  settings: SmsNotificationSettings;
}

/** Xabar tayyorlash draft (vaqtinchalik) */
export interface SmsComposeDraft {
  recipientIds: string[];
  message: string;
}

/** Arendator tanlash uchun ro‘yxat qatori */
export interface SmsTenantCandidate {
  tenantId: string;
  fullName: string;
  phone: string;
  propertyLabel: string;
  phoneValid: boolean;
  phoneInvalidReason?: string;
  alreadyLinked: boolean;
}
