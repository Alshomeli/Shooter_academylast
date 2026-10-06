export type ValidationResult = { valid: boolean; message?: string };

export function validateRequired(value: string, label: string): ValidationResult {
  if (!value || !value.trim()) return { valid: false, message: `${label} مطلوب` };
  return { valid: true };
}

export function validatePhone(value: string): ValidationResult {
  if (!value) return { valid: true };
  const cleaned = value.replace(/[\s-]/g, '');
  if (!/^\+?\d{8,15}$/.test(cleaned)) {
    return { valid: false, message: 'رقم الهاتف غير صحيح (8-15 رقماً)' };
  }
  return { valid: true };
}

export function validateEmail(value: string): ValidationResult {
  if (!value) return { valid: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, message: 'البريد الإلكتروني غير صحيح' };
  }
  return { valid: true };
}

export function validateNumber(value: number, min: number, max: number, label: string): ValidationResult {
  if (isNaN(value)) return { valid: false, message: `${label} يجب أن يكون رقماً` };
  if (value < min) return { valid: false, message: `${label} يجب أن يكون ${min} على الأقل` };
  if (value > max) return { valid: false, message: `${label} يجب أن يكون ${max} كحد أقصى` };
  return { valid: true };
}

export function validateJerseyUnique(
  jerseyNumber: number,
  players: Array<{ jerseyNumber: number; id?: string }>,
  currentId?: string,
): ValidationResult {
  const conflict = players.find(
    (p) => p.jerseyNumber === jerseyNumber && p.id !== currentId,
  );
  if (conflict) {
    return { valid: false, message: `رقم القميص ${jerseyNumber} مستخدم بالفعل` };
  }
  return { valid: true };
}
