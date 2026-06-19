export function suggestTenantLogin(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `user${digits.slice(-8)}`;
}

export function generateTenantPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
