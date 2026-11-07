export function resolveOnboardingMode(metadata: unknown, search: string): 'parent' | 'staff' | 'choose' {
  const view = new URLSearchParams(search).get('view');
  if (view === 'staff-registration') return 'staff';
  if (view === 'registration') return 'parent';
  if (metadata === 'staff' || metadata === 'parent') return metadata;
  return 'choose';
}
