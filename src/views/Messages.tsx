import { useState, useMemo } from 'react';
import {
  Send, Search, Users, User, Wallet, Dumbbell, Megaphone,
  CheckCircle2, MessageCircle, Mail, Copy, Filter,
} from 'lucide-react';
import type { Player, Team, Subscription, Lang, Role } from '@/types';
import { PageHeader, Badge, EmptyState, inputCls } from '@/components/ui';
import { tr } from '@/lib/i18n';

interface MessagesProps {
  players: Player[];
  teams: Team[];
  subscriptions: Subscription[];
  activeRole: Role;
  lang: Lang;
}

type MessageType = 'subscription' | 'training' | 'announcement' | 'custom';

const MESSAGE_TYPES: Array<{ value: MessageType; label: string; labelEn: string; icon: typeof Wallet; color: string }> = [
  { value: 'subscription', label: 'تذكير بالاشتراكات', labelEn: 'Subscription Reminder', icon: Wallet, color: 'emerald' },
  { value: 'training', label: 'تدريبات ومواعيد', labelEn: 'Training Schedule', icon: Dumbbell, color: 'blue' },
  { value: 'announcement', label: 'تعميم عام', labelEn: 'General Announcement', icon: Megaphone, color: 'amber' },
  { value: 'custom', label: 'رسالة مخصصة', labelEn: 'Custom Message', icon: MessageCircle, color: 'slate' },
];

type RecipientMode = 'all' | 'team' | 'individual';

const BUSINESS_WHATSAPP_DISPLAY = '0097332287776';
const BUSINESS_WHATSAPP_LINK = '97332287776';

function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export function Messages({ players, teams, subscriptions, lang }: MessagesProps) {
  const t = tr(lang);
  const isAr = lang === 'ar';

  const [messageType, setMessageType] = useState<MessageType>('subscription');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [openedLog, setOpenedLog] = useState<string[]>([]);

  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((tm) => m.set(tm.id, tm.name));
    return m;
  }, [teams]);

  const eligiblePlayers = useMemo(() => {
    return players.filter((p) => p.status === 'active' && p.parentPhone);
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return eligiblePlayers.filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.parentName.toLowerCase().includes(q) || p.parentPhone.includes(q);
    });
  }, [eligiblePlayers, search]);

  const selectedPlayer = useMemo(() => {
    return players.find((p) => p.id === selectedPlayerId) || null;
  }, [players, selectedPlayerId]);

  const recipients = useMemo(() => {
    if (recipientMode === 'all') return eligiblePlayers;
    if (recipientMode === 'team') return eligiblePlayers.filter((p) => p.teamId === selectedTeam);
    return selectedPlayer ? [selectedPlayer] : [];
  }, [recipientMode, eligiblePlayers, selectedTeam, selectedPlayer]);

  function buildMessage(player: Player): string {
    const teamName = teamMap.get(player.teamId) || '—';
    const sub = subscriptions.find((s) => s.playerId === player.id);

    if (messageType === 'subscription') {
      const planLabel = sub
        ? sub.planType === 'monthly' ? (isAr ? 'شهري' : 'Monthly')
        : sub.planType === 'quarterly' ? (isAr ? 'ربع سنوي' : 'Quarterly')
        : (isAr ? 'سنوي' : 'Yearly')
        : '';
      const status = sub
        ? sub.status === 'paid'
          ? (isAr ? 'مدفوع' : 'Paid')
          : (isAr ? 'غير مدفوع' : 'Unpaid')
        : (isAr ? 'لا يوجد اشتراك' : 'No subscription');
      const endDate = sub?.endDate || '—';
      return isAr
        ? `السلام عليكم ${player.parentName}،\n\nنذكركم بأن اشتراك اللاعب "${player.name}" (${teamName}) من نوع ${planLabel} ${status}.\nتاريخ انتهاء الاشتراك: ${endDate}.\n\nيرجى التجديد لتجنب إيقاف التدريبات.\n\nأكاديمية شوتر لكرة القدم`
        : `Dear ${player.parentName},\n\nReminder: Subscription for player "${player.name}" (${teamName}) - ${planLabel} plan is ${status}.\nExpiry date: ${endDate}.\n\nPlease renew to avoid training suspension.\n\nShooter Football Academy`;
    }

    if (messageType === 'training') {
      const team = teams.find((tm) => tm.id === player.teamId);
      const days = team?.trainingDays?.length ? team.trainingDays.join('، ') : (isAr ? 'غير محدد' : 'TBD');
      const time = team?.trainingTime || '—';
      const pitch = team?.pitchNumber || '—';
      return isAr
        ? `السلام عليكم ${player.parentName}،\n\nنحيطكم علماً بمواعيد تدريبات اللاعب "${player.name}" (${teamName}):\nالأيام: ${days}\nالتوقيت: ${time}\nالملعب: ${pitch}\n\nيرجى الالتزام بالحضور في الوقت المحدد.\n\nأكاديمية شوتر لكرة القدم`
        : `Dear ${player.parentName},\n\nTraining schedule for player "${player.name}" (${teamName}):\nDays: ${days}\nTime: ${time}\nPitch: ${pitch}\n\nPlease ensure timely attendance.\n\nShooter Football Academy`;
    }

    if (messageType === 'announcement') {
      const title = customTitle || (isAr ? 'تعميم هام' : 'Important Announcement');
      const body = customBody || (isAr ? 'يرجى الاطلاع على لوحة الإشعارات في النظام لمزيد من التفاصيل.' : 'Please check the notifications panel for more details.');
      return isAr
        ? `السلام عليكم ${player.parentName}،\n\n${title}\n\n${body}\n\nأكاديمية شوتر لكرة القدم`
        : `Dear ${player.parentName},\n\n${title}\n\n${body}\n\nShooter Football Academy`;
    }

    // custom
    const body = customBody || '';
    const title = customTitle ? `${customTitle}\n\n` : '';
    return isAr
      ? `السلام عليكم ${player.parentName}،\n\n${title}${body}\n\nأكاديمية شوتر لكرة القدم`
      : `Dear ${player.parentName},\n\n${title}${body}\n\nShooter Football Academy`;
  }

  function handleSendWhatsApp(player: Player) {
    const msg = buildMessage(player);
    const phone = cleanPhone(player.parentPhone);
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setOpenedLog((prev) => [...prev, player.id]);
  }

  function handleSendEmail(player: Player) {
    const msg = buildMessage(player);
    const subject = messageType === 'subscription'
      ? (isAr ? 'تذكير بالاشتراك' : 'Subscription Reminder')
      : messageType === 'training'
      ? (isAr ? 'مواعيد التدريبات' : 'Training Schedule')
      : customTitle || (isAr ? 'تعميم من الأكاديمية' : 'Academy Announcement');
    const url = `mailto:${player.parentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setOpenedLog((prev) => [...prev, player.id]);
  }

  function handleCopyMessage(player: Player) {
    const msg = buildMessage(player);
    navigator.clipboard.writeText(msg).catch(() => {});
    setOpenedLog((prev) => [...prev, `${player.id}-copy`]);
  }

  function handleBulkWhatsApp() {
    // Browsers commonly block multiple popups from one click. Open the first
    // recipient and let staff continue individually from the visible list.
    const first = recipients.find((player) => cleanPhone(player.parentPhone));
    if (!first) return;
    handleSendWhatsApp(first);
  }

  const previewMessage = recipients.length > 0 ? buildMessage(recipients[0]) : '';

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t.messages}
        subtitle={isAr ? 'إرسال رسائل جماعية وفردية لأولياء أمور اللاعبين' : 'Send bulk and individual messages to player parents'}
      >
        <Badge color="emerald">{recipients.length} {isAr ? 'مستلم' : 'recipients'}</Badge>
      </PageHeader>

      {/* Message type cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MESSAGE_TYPES.map((mt) => {
          const Icon = mt.icon;
          const active = messageType === mt.value;
          return (
            <button
              key={mt.value}
              onClick={() => setMessageType(mt.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                active
                  ? 'bg-brand-600 text-white'
                  : `bg-${mt.color}-100 dark:bg-${mt.color}-900/30 text-${mt.color}-600 dark:text-${mt.color}-400`
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-bold ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}>
                {isAr ? mt.label : mt.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom text fields for announcement/custom */}
      {(messageType === 'announcement' || messageType === 'custom') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'العنوان' : 'Title'}
            </label>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={isAr ? 'أدخل عنوان الرسالة...' : 'Enter message title...'}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? 'نص الرسالة' : 'Message Body'}
            </label>
            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={3}
              placeholder={isAr ? 'أدخل نص الرسالة...' : 'Enter message body...'}
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* Recipient selector */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white">
            {isAr ? 'اختيار المستلمين' : 'Select Recipients'}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { value: 'all' as const, label: isAr ? 'كل اللاعبين' : 'All Players', icon: Users },
            { value: 'team' as const, label: isAr ? 'حسب الفريق' : 'By Team', icon: Users },
            { value: 'individual' as const, label: isAr ? 'لاعب محدد' : 'Individual', icon: User },
          ]).map((mode) => {
            const Icon = mode.icon;
            const active = recipientMode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setRecipientMode(mode.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  active
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Team selector */}
        {recipientMode === 'team' && (
          <div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className={inputCls}
            >
              <option value="">{isAr ? 'اختر فريقاً...' : 'Select a team...'}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name} — {tm.ageGroup}</option>
              ))}
            </select>
          </div>
        )}

        {/* Individual selector */}
        {recipientMode === 'individual' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم اللاعب أو ولي الأمر...' : 'Search by player or parent name...'}
                className="w-full bg-slate-50 dark:bg-slate-800 text-sm py-2.5 pr-10 pl-4 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {filteredPlayers.map((p) => {
                const isSelected = selectedPlayerId === p.id;
                const isSent = openedLog.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayerId(p.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-brand-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0">
                      👤
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.parentName}</p>
                    </div>
                    {isSent && <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0" aria-label={isAr ? 'تم فتح قناة الإرسال' : 'Sending channel opened'} />}
                  </button>
                );
              })}
            </div>
            {filteredPlayers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">{isAr ? 'لا يوجد لاعبون مطابقون' : 'No matching players'}</p>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      {recipients.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {isAr ? 'معاينة الرسالة' : 'Message Preview'}
          </h3>
          <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
            {previewMessage}
          </pre>
        </div>
      )}

      {/* Action bar */}
      {recipients.length > 0 ? (
        <div className="sticky bottom-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/40 px-3 py-2.5">
            <div>
              <p className="text-xs font-black text-brand-800 dark:text-brand-200">
                {isAr ? 'واتساب الأعمال للإشعارات الجماعية' : 'Business WhatsApp for bulk notifications'}
              </p>
              <p className="text-xs text-brand-700 dark:text-brand-300" dir="ltr">{BUSINESS_WHATSAPP_DISPLAY}</p>
            </div>
            <a
              href={`https://wa.me/${BUSINESS_WHATSAPP_LINK}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-600 hover:bg-brand-500 text-white px-3 py-2 text-xs font-bold transition"
            >
              {isAr ? 'فتح واتساب الأعمال' : 'Open Business WhatsApp'}
            </a>
          </div>

          {recipientMode !== 'individual' && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isAr ? `تم تجهيز الرسالة لـ ${recipients.length} ولي أمر — افتح المستلمين واحدًا تلو الآخر لتجنب حظر النوافذ` : `Message prepared for ${recipients.length} parents — open recipients one by one to avoid popup blocking`}
              </p>
              <button
                onClick={handleBulkWhatsApp}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold transition cursor-pointer shadow-sm"
              >
                <Send className="h-4 w-4" />
                {isAr ? 'فتح أول مستلم في واتساب' : 'Open first recipient in WhatsApp'}
              </button>
            </div>
          )}

          {/* Individual send list */}
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {recipients.map((player) => {
              const isSent = openedLog.includes(player.id);
              const teamName = teamMap.get(player.teamId) || '—';
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0">
                    👤
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{player.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {player.parentName} · {teamName} · <span dir="ltr">{player.parentPhone}</span>
                    </p>
                  </div>
                  {isSent && <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0" />}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyMessage(player)}
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
                      title={isAr ? 'نسخ' : 'Copy'}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {player.parentEmail && (
                      <button
                        onClick={() => handleSendEmail(player)}
                        className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition cursor-pointer"
                        title={isAr ? 'بريد' : 'Email'}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleSendWhatsApp(player)}
                      className="p-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 hover:bg-brand-200 dark:hover:bg-brand-900/50 transition cursor-pointer"
                      title={isAr ? 'واتساب' : 'WhatsApp'}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Send className="h-8 w-8" />}
          title={isAr ? 'لا يوجد مستلمون' : 'No recipients'}
          subtitle={isAr ? 'اختر فريقاً أو لاعباً لإرسال الرسالة' : 'Select a team or player to send a message'}
        />
      )}
    </div>
  );
}
