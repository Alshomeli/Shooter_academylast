import type { Role, ViewId } from '../types';

const NAVIGATION_TAB_IDS = new Set<ViewId>([
  'dashboard',
  'approvals',
  'registration-admin',
  'players',
  'parents',
  'teams',
  'staff',
  'subscriptions',
  'attendance',
  'schedules',
  'tournaments',
  'evaluations',
  'reports',
  'audit-logs',
  'ai-center',
  'messages',
  'site-content',
  'settings',
]);

export function isNavigationTab(value: string | null): value is ViewId {
  return value !== null && NAVIGATION_TAB_IDS.has(value as ViewId);
}

type AllowedViewsByRole = Readonly<Record<Exclude<Role, 'parent'>, readonly ViewId[]>>;

export function getPostLoginTab(
  user: { role: Role; registrationOnly?: boolean; registrationMode?: string },
  view: string | null,
  tab: string | null,
  allowedViewsByRole: AllowedViewsByRole,
): ViewId {
  if (user.registrationOnly && user.registrationMode === 'staff') return 'staff-registration';
  if (user.role === 'parent' && !user.registrationOnly) return 'dashboard';
  if (view === 'registration' || view === 'staff-registration') return view;
  if (!user.registrationOnly && user.role !== 'parent' && isNavigationTab(tab)) {
    return allowedViewsByRole[user.role].includes(tab) ? tab : 'dashboard';
  }
  return 'dashboard';
}

export function getInitialTab(pathname: string, search: string, hash: string): ViewId {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/parent') return 'registration';
  if (path === '/coach') return 'staff-registration';

  const params = new URLSearchParams(search);
  const view = params.get('view') || hash.replace(/^#/, '');
  if (view === 'registration' || view === 'staff-registration' || view === 'registration-admin') {
    return view;
  }

  const tab = params.get('tab');
  return isNavigationTab(tab) ? tab : 'dashboard';
}

export function getTabUrl(tab: ViewId, href: string): string {
  const url = new URL(href);
  if (isNavigationTab(tab) && tab !== 'dashboard') url.searchParams.set('tab', tab);
  else url.searchParams.delete('tab');
  return `${url.pathname}${url.search}${url.hash}`;
}
