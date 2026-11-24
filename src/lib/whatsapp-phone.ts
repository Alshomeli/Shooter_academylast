/** Bahrain local numbers use +973; explicit international numbers retain their country. */
export function normalizeWhatsAppPhone(value: string): string {
  const ascii = value.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0));
  let digits = ascii.replace(/\D/g, '');
  const international = /^\s*(?:\+|00)/.test(ascii);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!international && digits.length === 8) digits = '973' + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}
