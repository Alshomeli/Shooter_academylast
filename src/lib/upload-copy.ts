import type { Lang } from '@/types';

export type UploadCategory = 'photo' | 'document';

export function documentUploadCopy(lang: Lang, category: UploadCategory) {
  const isArabic = lang === 'ar';
  const photo = category === 'photo';

  return {
    fileCount: (count: number) => isArabic
      ? `${count} ${count === 1 ? 'ملف' : 'ملفات'}`
      : `${count} ${count === 1 ? 'file' : 'files'}`,
    uploading: isArabic ? 'جارٍ رفع الملفات وضغط الصور…' : 'Uploading files and compressing images…',
    dropPrompt: isArabic ? 'انقر لاختيار الملفات أو اسحبها إلى هنا' : 'Click to choose files or drag them here',
    guidance: photo
      ? (isArabic
        ? 'JPG أو PNG أو WebP · حتى 20 ميجابايت للصورة قبل الضغط؛ ضغط تلقائي بهدف 2 ميجابايت.'
        : 'JPG, PNG, or WebP · up to 20 MB per image before compression; auto-compressed to a 2 MB target.')
      : (isArabic
        ? 'PDF حتى 5 ميجابايت · PNG حتى 20 ميجابايت قبل الضغط؛ ضغط تلقائي للصور بهدف 2 ميجابايت.'
        : 'PDF up to 5 MB · PNG up to 20 MB before compression; images are auto-compressed to a 2 MB target.'),
    empty: isArabic ? 'لا توجد ملفات مرفوعة بعد' : 'No files uploaded yet',
    deleteTitle: isArabic ? 'حذف الملف' : 'Delete file',
    deleteMessage: (fileName: string) => isArabic
      ? `هل تريد حذف «${fileName}»؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Delete “${fileName}”? This action cannot be undone.`,
    delete: isArabic ? 'حذف' : 'Delete',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    download: isArabic ? 'تنزيل' : 'Download',
    uploadError: isArabic ? 'تعذر رفع الملف. حاول مرة أخرى.' : 'Could not upload the file. Please try again.',
    deleteError: isArabic ? 'تعذر حذف الملف. حاول مرة أخرى.' : 'Could not delete the file. Please try again.',
    closeError: isArabic ? 'إغلاق رسالة الخطأ' : 'Dismiss error message',
  };
}

const ERROR_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  'صيغة الملف غير مدعومة. المسموح: JPG, PNG, WebP, PDF': {
    ar: 'صيغة الملف غير مدعومة. الصيغ المسموحة: JPG وPNG وWebP وPDF.',
    en: 'Unsupported file type. Allowed formats: JPG, PNG, WebP, and PDF.',
  },
  'تعذر ضغط الصورة إلى الحجم المطلوب. اختر صورة أصغر.': {
    ar: 'تعذر ضغط الصورة إلى الحجم المطلوب. اختر صورة أصغر.',
    en: 'The image could not be compressed to the target size. Choose a smaller image.',
  },
  'تعذر معالجة الصورة': {
    ar: 'تعذرت معالجة الصورة.',
    en: 'The image could not be processed.',
  },
  'تعذر ضغط الصورة': {
    ar: 'تعذر ضغط الصورة.',
    en: 'The image could not be compressed.',
  },
  'فشل رفع الملف. يرجى المحاولة مرة أخرى.': {
    ar: 'فشل رفع الملف. يرجى المحاولة مرة أخرى.',
    en: 'The file upload failed. Please try again.',
  },
  'فشل حفظ بيانات الملف': {
    ar: 'فشل حفظ بيانات الملف.',
    en: 'The file information could not be saved.',
  },
  'فشل إنشاء رابط الملف': {
    ar: 'تعذر إنشاء رابط الملف.',
    en: 'A link for the file could not be created.',
  },
  'يجب تسجيل الدخول لحذف الملفات': {
    ar: 'يرجى تسجيل الدخول لحذف الملفات.',
    en: 'Please sign in before deleting files.',
  },
};

export function uploadErrorCopy(message: string, lang: Lang): string {
  const isArabic = lang === 'ar';
  const exact = ERROR_TRANSLATIONS[message];
  if (exact) return exact[isArabic ? 'ar' : 'en'];

  const sizeError = message.match(/^حجم الملف كبير جداً\. الحد الأقصى (\d+) ميجابايت$/);
  if (sizeError) {
    return isArabic
      ? `حجم الملف كبير جدًا. الحد الأقصى ${sizeError[1]} ميجابايت.`
      : `The file is too large. Maximum size: ${sizeError[1]} MB.`;
  }

  const deleteStatus = message.match(/^فشل الحذف \((\d{3})\)$/);
  if (deleteStatus) {
    return isArabic
      ? `فشل حذف الملف (رمز الحالة ${deleteStatus[1]}).`
      : `The file could not be deleted (status ${deleteStatus[1]}).`;
  }
  if (message.startsWith('فشل الحذف:')) {
    return isArabic ? 'فشل حذف الملف. حاول مرة أخرى.' : 'The file could not be deleted. Please try again.';
  }
  if (message === 'Upload error') return documentUploadCopy(lang, 'photo').uploadError;
  if (message === 'Delete error') return documentUploadCopy(lang, 'photo').deleteError;
  return message;
}
