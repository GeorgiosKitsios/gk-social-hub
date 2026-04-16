export default function PrivacyPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-6">Datenschutzrichtlinie</h1>
      <p className="text-neutral-400 text-sm mb-6">Stand: April 2026</p>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">1. Verantwortlicher</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Georgios Kitsios<br />
          georgioskitsios@web.de<br />
          München, Deutschland
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">2. Welche Daten wir verarbeiten</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          GK Social Hub verarbeitet ausschließlich Daten, die zur Nutzung der App erforderlich sind:
        </p>
        <ul className="text-neutral-300 text-sm mt-2 list-disc list-inside space-y-1">
          <li>Facebook Page Access Tokens (zur Veröffentlichung von Beiträgen)</li>
          <li>Inhalte, die du selbst in der App erstellst (Posts, Medien, Vorlagen)</li>
          <li>Keine personenbezogenen Daten Dritter werden gespeichert</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">3. Facebook-Daten</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Die App verwendet die Meta Graph API, um Beiträge auf deinen Facebook Pages zu veröffentlichen.
          Wir speichern nur den Page Access Token, der für die Veröffentlichung notwendig ist.
          Dieser Token wird ausschließlich lokal in deinem Browser gespeichert und nicht an Dritte weitergegeben.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">4. Datenlöschung</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Du kannst deine Daten jederzeit löschen, indem du die Verbindung in der App trennst
          oder den Browser-Speicher (localStorage) leerst.
          Zur Löschung deiner Facebook-Daten wende dich an: georgioskitsios@web.de
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">5. Kontakt</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Bei Fragen zur Datenschutzrichtlinie:<br />
          georgioskitsios@web.de
        </p>
      </section>
    </div>
  );
}
