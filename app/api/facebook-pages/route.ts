/**
 * app/api/facebook-pages/route.ts
 *
 * Read-only: liefert die echte Seiten-/Marken-Zuordnung aus Supabase.
 * Nur page_id, brand_id und name – KEINE Access-Tokens.
 *
 * Wird im Browser genutzt, um die (ggf. veralteten) brand_ids im localStorage
 * mit den autoritativen Supabase-Werten zu korrigieren und die Konto-Vorauswahl
 * im Post-Editor korrekt zu treffen.
 *
 * GET /api/facebook-pages → { pages: Array<{ page_id, brand_id, name }> }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Nicht konfiguriert → leer (Aufrufer fällt auf Namensabgleich zurück).
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ pages: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('facebook_pages')
    .select('page_id, brand_id, name');

  if (error) {
    console.error('[facebook-pages] Lesefehler:', error.message);
    // 500 → fetchSupabaseFbPages() liefert null → Namensabgleich greift.
    return NextResponse.json({ pages: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pages: data ?? [] });
}
