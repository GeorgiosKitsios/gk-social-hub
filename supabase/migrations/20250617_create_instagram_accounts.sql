-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: instagram_accounts
--
-- Tabelle für Instagram Business Accounts, die über den Facebook-OAuth-Login
-- verknüpft wurden. Der Cron-Job (/api/cron/publish) liest von hier den Token.
--
-- Join-Schlüssel: instagram_accounts.id = facebook_pages.page_id
--   → Darüber wird der IG-Account einer Brand zugeordnet.
--
-- Ausführen: Supabase Dashboard → SQL Editor → diesen Block einfügen → Run
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  -- PK = Facebook Page ID (nicht die IG-Account-ID!).
  -- Über diesen Wert findet der Cron-Job die Brand-Zuordnung.
  id           TEXT        PRIMARY KEY,

  -- Anzeigename, z. B. "FC Hellas (@fc_hellas_muenchen)"
  name         TEXT        NOT NULL DEFAULT '',

  -- Instagram Business Account ID (z. B. "17841400123456789")
  account_id   TEXT        NOT NULL DEFAULT '',

  -- Page Access Token – funktioniert auch für IG Publishing
  access_token TEXT        NOT NULL DEFAULT '',

  -- Wird bei jedem Sync aktualisiert (→ Token-Aktualität nachvollziehbar)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Tabelle ist server-only (nur Service Role Key darf lesen/schreiben).
-- Browser-Clients haben keinen Zugriff.
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

-- Service Role bypasses RLS automatisch – kein explizites Policy nötig.
-- Anon/Auth dürfen NICHTS:
DROP POLICY IF EXISTS "no_public_access" ON public.instagram_accounts;
CREATE POLICY "no_public_access"
  ON public.instagram_accounts
  FOR ALL
  TO anon, authenticated
  USING (false);

-- ── Kontrollabfrage nach der Migration ────────────────────────────────────────
-- Führe das nach dem Erstellen aus, um den Inhalt zu prüfen:
--
-- SELECT id, name, account_id,
--        LEFT(access_token, 10) || '…' AS token_preview,
--        updated_at
-- FROM instagram_accounts;
