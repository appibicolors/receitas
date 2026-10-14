import { createClient } from '@supabase/supabase-js';
import { isAdministrativeKey } from './public-key';
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url &&
  key &&
  !url.includes('PROJECT_REF') &&
  !key.includes('REPLACE') &&
  !isAdministrativeKey(key),
);
export const supabase = createClient(
  configured ? url : 'https://unconfigured.supabase.co',
  configured ? key : 'unconfigured',
  {
    auth: {
      storageKey: 'ibicolor-rama-session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
export function fail(error: { message: string } | null) {
  if (error) throw Error(error.message);
}
