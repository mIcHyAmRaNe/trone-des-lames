import { useEffect, useState } from 'react';
import { loadCatalog, slotLabel } from '../lib/wardrobe';

function parseNumbers(raw: string): number[] | null {
  if (!raw.trim()) return [];
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

export default function SubmitForm({ player }: { player: string }) {
  const [slots, setSlots] = useState<string[]>([]);
  const [nom, setNom] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [slot, setSlot] = useState('');
  const [sexe, setSexe] = useState('Mixte');
  const [zIndex, setZIndex] = useState('');
  const [declinaisons, setDeclinaisons] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    loadCatalog().then((catalog) => {
      const allSlots = [...new Set([...catalog.sexes.M, ...catalog.sexes.F].map((i) => i.slot))];
      setSlots(allSlots.sort());
    }).catch(() => setMessage('Le catalogue n’a pas pu être chargé. Réessayez.'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    const z = parseNumbers(zIndex);
    if (z === null || z.length === 0) return setMessage('zIndexCalques : entrez au moins un nombre.');
    const d = parseNumbers(declinaisons);
    if (d === null) return setMessage('Déclinaisons : entrez des nombres séparés par des virgules ou des espaces.');
    setBusy(true);
    setMessage('Envoi en cours…');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            nom: nom.trim(),
            ...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}),
            ...(nameFr.trim() ? { nameFr: nameFr.trim() } : {}),
            slot: slot.trim(),
            sexes: sexe === 'Mixte' ? ['M', 'F'] : [sexe],
            ...(d.length ? { declinaisons: d } : {}),
            zIndex: z,
            ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        }),
      });
      if (res.status === 401) return setMessage('Connectez-vous sur la page Garde-robe d’abord.');
      if (res.status === 429) return setMessage('Trop de soumissions — attendez un peu et réessayez.');
      if (!res.ok) {
        let detail = `Erreur ${res.status}.`;
        try {
          detail = (await res.json()).error ?? detail;
        } catch { /* non-JSON error body */ }
        return setMessage(detail);
      }
      const { id } = await res.json();
      setOk(true);
      setMessage(`Soumis ! id ${id}.`);
    } catch {
      setMessage('Serveur injoignable. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-dark texture-noise rounded-lg p-6">
      <p className="text-sm text-parchment-dim">
        Soumission en tant que <span className="font-semibold text-parchment">{player}</span>
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Nom (requis)</span>
          <input value={nom} required onChange={(e) => setNom(e.target.value)}
            placeholder="ex. collierMarchand" className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
          <span className="mt-1 block text-[0.6875rem] text-parchment-dim/50">Nom CDN</span>
        </label>
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Nom affiché EN (optionnel)</span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Nom affiché FR (optionnel)</span>
          <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Emplacement (requis)</span>
          <input value={slot} required list="known-slots" onChange={(e) => setSlot(e.target.value)}
            className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
          <datalist id="known-slots">{slots.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <fieldset className="sm:col-span-2 text-sm text-parchment-dim">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Sexes (requis)</legend>
          <div className="flex gap-2">
            {(['Mixte', 'M', 'F'] as const).map((v) => (
              <label key={v} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${sexe === v ? 'border-gold/50 bg-gold/10 text-parchment' : 'border-parchment-dim/25 text-parchment-dim hover:border-parchment-dim/40'}`}>
                <input type="radio" name="sexes" value={v} checked={sexe === v} onChange={() => setSexe(v)} required className="sr-only" />
                {v === 'Mixte' ? 'Mixte' : v}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">zIndexCalques (requis)</span>
          <input value={zIndex} required onChange={(e) => setZIndex(e.target.value)}
            placeholder="ex. 42 ou 40, 41" className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
        <label className="block text-sm text-parchment-dim">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Déclinaisons (optionnel)</span>
          <input value={declinaisons} onChange={(e) => setDeclinaisons(e.target.value)}
            placeholder="ex. 0 1 2" className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
        <label className="block text-sm text-parchment-dim sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">URL source (optionnel)</span>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} inputMode="url" className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
        <label className="block text-sm text-parchment-dim sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60">Note (optionnel)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold" />
        </label>
      </div>
      <button type="submit" disabled={busy} className="btn-gold mt-5 w-full py-2.5 disabled:opacity-50">
        {busy ? 'Envoi…' : 'Soumettre l’objet'}
      </button>
      {message && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-parchment-dim/25 bg-parchment/[0.03] text-parchment-dim'}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
