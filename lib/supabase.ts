import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl)    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt.');
if (!supabaseKey)    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt.');
if (!serviceRoleKey) console.error('[Supabase] SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt – Server-Uploads und DB-Inserts werden durch RLS blockiert.');

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

/** Browser-Client – Anon Key, für Client-Komponenten */
export const supabase = createClient(
  supabaseUrl ?? PLACEHOLDER_URL,
  supabaseKey ?? PLACEHOLDER_KEY
);

/** Server-Admin-Client – Service Role Key, umgeht RLS.
 *  NUR in API-Routes und Server-Code verwenden, nie im Browser! */
export const supabaseAdmin = createClient(
  supabaseUrl ?? PLACEHOLDER_URL,
  serviceRoleKey ?? PLACEHOLDER_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  }
);

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl && serviceRoleKey);
}
