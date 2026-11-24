export function getLoginScreen({ recovery, registrationEntry, staffRegistrationEntry, search }: { recovery: boolean; registrationEntry: boolean; staffRegistrationEntry: boolean; search: string }): 'login' | 'register' | 'forgot' | 'reset' {
  if (recovery) return 'reset';
  if (registrationEntry || staffRegistrationEntry) return 'register';
  return new URLSearchParams(search).get('screen') === 'forgot' ? 'forgot' : 'login';
}
