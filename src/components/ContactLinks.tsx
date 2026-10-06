import { Phone, MessageCircle, Mail, MapPin } from 'lucide-react';

function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

interface ContactLinksProps {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  small?: boolean;
}

/** Renders clickable contact icons that open native phone/WhatsApp/email/maps apps on mobile & desktop */
export function ContactLinks({ phone, whatsapp, email, address, small }: ContactLinksProps) {
  const size = small ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const pad = small ? 'p-1.5' : 'p-2';
  const wPhone = whatsapp ? cleanPhone(whatsapp) : '';
  const telPhone = phone ? cleanPhone(phone) : '';
  const waLink = wPhone ? `https://wa.me/${wPhone}` : '';
  const telLink = telPhone ? `tel:${telPhone}` : '';
  const mailLink = email ? `mailto:${email}` : '';
  const mapLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';

  const cls = `${pad} rounded-lg transition cursor-pointer`;

  return (
    <div className="flex items-center gap-1.5">
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} bg-brand-100 dark:bg-brand-900/30 text-brand-600 hover:bg-brand-200 dark:hover:bg-brand-900/50`}
          title="WhatsApp"
        >
          <MessageCircle className={size} />
        </a>
      )}
      {telLink && (
        <a
          href={telLink}
          className={`${cls} bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50`}
          title="Call"
        >
          <Phone className={size} />
        </a>
      )}
      {mailLink && (
        <a
          href={mailLink}
          className={`${cls} bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700`}
          title="Email"
        >
          <Mail className={size} />
        </a>
      )}
      {mapLink && (
        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50`}
          title="Location"
        >
          <MapPin className={size} />
        </a>
      )}
    </div>
  );
}
