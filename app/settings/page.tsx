DATEI: app/settings/page.tsx
// ============================================================
'use client';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8"><h1 className="text-xl font-semibold text-white">Einstellungen</h1><p className="text-sm text-neutral-400 mt-0.5">App-Konfiguration und Marken-Verwaltung</p></div>
      <div className="flex flex-col gap-3">
        {[{ title: 'Marken verwalten', description: 'Marken anlegen, bearbeiten und archivieren.', href: '/brands', action: 'Zu den Marken →' }, { title: 'Social-Media-Konten', description: 'Plattform-Verbindungen verwalten.', href: '/accounts', action: 'Zu den Konten →' }].map(s => (
          <div key={s.href} className="bg-neutral-800 border border-neutral-700 rounded-xl p-5 flex items-center justify-between gap-4">
            <div><div className="text-sm font-medium text-white mb-1">{s.title}</div><div className="text-xs text-neutral-400">{s.description}</div></div>
            <Link href={s.href} className="text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-300 hover:text-white hover:border-neutral-400 transition-colors shrink-0">{s.action}</Link>
          </div>
        ))}
        <div className="bg-neutral-800/50 border border-dashed border-neutral-700 rounded-xl p-5"><div className="text-sm font-medium text-neutral-500 mb-1">Weitere Einstellungen</div><div className="text-xs text-neutral-600">Benachrichtigungen und KI-Feintuning folgen in Phase 2.</div></div>
      </div>
    </div>
  );
}
