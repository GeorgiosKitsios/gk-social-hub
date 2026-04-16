export default function TermsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-6">Nutzungsbedingungen</h1>
      <p className="text-neutral-400 text-sm mb-6">Stand: April 2026</p>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">1. Geltungsbereich</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          GK Social Hub ist ein privates Social-Media-Management-Tool von Georgios Kitsios,
          München. Die Nutzung ist auf autorisierte Nutzer beschränkt.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">2. Nutzung</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Die App darf ausschließlich für legale Zwecke verwendet werden.
          Der Nutzer ist selbst verantwortlich für alle Inhalte, die über die App
          auf sozialen Netzwerken veröffentlicht werden.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">3. Haftung</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Georgios Kitsios übernimmt keine Haftung für Schäden, die durch die Nutzung
          der App entstehen. Die Nutzung erfolgt auf eigene Gefahr.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">4. Änderungen</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Diese Nutzungsbedingungen können jederzeit geändert werden.
          Die aktuelle Version ist stets unter dieser URL abrufbar.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">5. Kontakt</h2>
        <p className="text-neutral-300 text-sm leading-relaxed">
          georgioskitsios@web.de
        </p>
      </section>
    </div>
  );
}
