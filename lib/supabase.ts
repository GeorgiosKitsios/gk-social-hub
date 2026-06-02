import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl)  console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt – alle Supabase-Aufrufe werden fehlschlagen.');
if (!supabaseKey)  console.error('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt – alle Supabase-Aufrufe werden fehlschlagen.');

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder-key'
);
