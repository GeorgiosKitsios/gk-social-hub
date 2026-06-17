/**
 * app/api/ig-accounts/sync/route.ts
 *
 * Dedizierte Server-Route: schreibt Instagram-Accounts aus dem Browser-
 * localStorage in die Supabase-Tabelle instagram_accounts.
 *
 * Aufgerufen von app/accounts/page.tsx (Client-Komponente) nach dem
 * Facebook-OAuth-Callback und beim initialen Laden der Accounts-Seite.
 *
 * Kein Auth-Guard nötig: schreibt nur eigene Tokens, die der Browser
 * gerade selbst vom Facebook-OAuth erhalten hat.
 * Nutzt ausschließlich den service_role-Key (server-only), der RLS umgeht.
 *
 * POST /api/ig-accounts/sync
 * Body: { accounts: Array<{ id, name, accountId, accessToken }> }
 * Response: { ok: true, synced: number }
 *         | { ok: false, error, code?, details?, hint? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface IgAccountPayload {
  id:          string;  // Facebook Page ID – PK + Join-Schlüssel im Cron
  name:        string;
  accountId:   string;  // IG Business Account ID
  accessToken: string;  // Page Access Token
}

export async function POST(req: NextRequest) {
  // ── 1. Service-Role-Key prüfen ───────────────────────────────────────────────
  if (!hasSupabaseAdminConfig()) {
    console.error('[IG-SYNC] SUPABASE_SERVICE_ROLE_KEY nicht gesetzt – Upsert abgebrochen');
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY fehlt (Hostinger Env-Variablen prüfen).' },
      { status: 500 }
    );
  }

  // ── 2. Body parsen ───────────────────────────────────────────────────────────
  let accounts: IgAccountPayload[];
  try {
    const body = await req.json();
    accounts = Array.isArray(body.accounts) ? body.accounts : [];
  } catch {
    return NextResponse.json({ ok: false, error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  console.log(`[IG-SYNC] ${accounts.length} Account(s) empfangen:`,
    accounts.map(a => ({ id: a.id, accountId: a.accountId, nameLen: a.name?.length, tokenLen: a.accessToken?.length })));

  if (accounts.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'Keine Accounts übergeben.' });
  }

  // ── 3. Zeilen für Supabase aufbauen ─────────────────────────────────────────
  const rows = accounts.map(a => ({
    id:           a.id,
    name:         a.name          ?? '',
    account_id:   a.accountId     ?? '',
    access_token: a.accessToken   ?? '',
    updated_at:   new Date().toISOString(),
  }));

  console.log('[IG-SYNC] Upsert-Zeilen (ohne Token):', rows.map(r => ({
    id:         r.id,
    account_id: r.account_id,
    name:       r.name,
    token_len:  r.access_token.length,
  })));

  // ── 4. Upsert via service_role-Key (umgeht RLS) ──────────────────────────────
  const { error } = await supabaseAdmin
    .from('instagram_accounts')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[IG-SYNC] Upsert FEHLER:',
      '| message:', error.message,
      '| code:',    error.code,
      '| details:', error.details,
      '| hint:',    error.hint,
    );
    return NextResponse.json({
      ok:      false,
      error:   error.message,
      code:    error.code,
      details: error.details,
      hint:    error.hint,
    }, { status: 500 });
  }

  console.log('[IG-SYNC] ✓ Upsert OK – gespeicherte IDs:', rows.map(r => r.id).join(', '));
  return NextResponse.json({ ok: true, synced: rows.length });
}
