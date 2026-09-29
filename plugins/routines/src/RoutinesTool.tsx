import { useEffect, useRef, useState } from "react";
import { PinButton, saveFileAs, SyncSetup, type ToolScreenProps } from "../../shared/hub";
import { Affichage } from "./Affichage";
import { chercher, CREDIT, urlPicto, type Picto } from "./arasaac";
import { nouvelId, type Donnees, type Routine } from "./donnees";
import { pdfRoutine } from "./impression";
import { nomFichier } from "./pdf";
import { ID, useRoutines } from "./store";

const DOSSIER = "ExziHub/Routines";
const android = /Android/i.test(navigator.userAgent);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

type Modifier = (f: (d: Donnees) => Donnees) => Promise<void>;

/** Suppression en deux clics : evite de perdre une routine sur un clic de travers. */
function Supprimer({ onConfirm, libelle = "✕" }: { onConfirm: () => void; libelle?: string }) {
  const [arme, setArme] = useState(false);
  return arme
    ? <button className="rtn-confirmer" onClick={onConfirm} onBlur={() => setArme(false)} autoFocus>Delete?</button>
    : <button className="btn-ghost" title="Delete" onClick={() => setArme(true)}>{libelle}</button>;
}

/** Champ enregistre a la sortie (ou sur Entree) : pas une ecriture Nextcloud par touche. */
function ChampTexte({ valeur, onValider, className, titre }: { valeur: string; onValider: (t: string) => void; className?: string; titre: string }) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  const valider = () => {
    const t = v.trim();
    if (t && t !== valeur) onValider(t);
    else setV(valeur);
  };
  return (
    <input className={className} value={v} title={titre} onChange={(e) => setV(e.target.value)} onBlur={valider}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

function Recherche({ onChoisir }: { onChoisir: (p: Picto) => void }) {
  const [terme, setTerme] = useState("");
  const [resultats, setResultats] = useState<Picto[] | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const encours = useRef<AbortController | null>(null);

  const lancer = async () => {
    const t = terme.trim();
    if (!t) return;
    encours.current?.abort();
    const a = new AbortController();
    encours.current = a;
    setEtat("Searching…");
    try {
      const r = await chercher(t, a.signal);
      setResultats(r);
      setEtat(r.length === 0 ? `No pictogram for "${t}".` : null);
    } catch (e) {
      if (!a.signal.aborted) setEtat(`Search failed: ${message(e)}`);
    }
  };

  return (
    <>
      <form className="rtn-form" onSubmit={(e) => { e.preventDefault(); void lancer(); }}>
        <input value={terme} onChange={(e) => setTerme(e.target.value)} placeholder="Search a pictogram in French (ex. brosser les dents)" />
        <button type="submit" className="btn-primary" disabled={!terme.trim()}>Search</button>
      </form>
      {etat && <p className="hint">{etat}</p>}
      {resultats && resultats.length > 0 && (
        <div className="rtn-resultats">
          {resultats.map((p) => (
            <button key={p.id} className="rtn-resultat" title={`Add "${p.mot}"`} onClick={() => onChoisir(p)}>
              <img src={urlPicto(p.id)} alt="" loading="lazy" />
              <span>{p.mot}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Editeur({ routine, modifier, onAfficher }: { routine: Routine; modifier: Modifier; onAfficher: () => void }) {
  const [pdf, setPdf] = useState<string | null>(null);
  const changer = (f: (r: Routine) => Routine) =>
    modifier((d) => ({ ...d, routines: d.routines.map((r) => (r.id === routine.id ? f(r) : r)) }));
  const deplacer = (i: number, sens: -1 | 1) => void changer((r) => {
    const etapes = [...r.etapes];
    const j = i + sens;
    if (j < 0 || j >= etapes.length) return r;
    [etapes[i], etapes[j]] = [etapes[j], etapes[i]];
    return { ...r, etapes };
  });

  const exporter = async () => {
    setPdf("Preparing the PDF…");
    try {
      const chemin = await saveFileAs(nomFichier(routine.nom), await pdfRoutine(routine));
      setPdf(chemin && !android ? `Saved: ${chemin}` : null);
    } catch (e) {
      setPdf(`PDF failed: ${message(e)}`);
    }
  };

  return (
    <>
      <section className="rtn-bloc">
        <div className="rtn-titre">
          <ChampTexte className="rtn-nom" valeur={routine.nom} titre="Routine name" onValider={(nom) => void changer((r) => ({ ...r, nom }))} />
          <div className="rtn-actions">
            <button className="btn-primary" onClick={onAfficher} disabled={routine.etapes.length === 0}>▶ Show</button>
            <button onClick={() => void exporter()} disabled={routine.etapes.length === 0}>{android ? "Print / PDF" : "PDF"}</button>
            <Supprimer libelle="Delete routine" onConfirm={() => void modifier((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== routine.id) }))} />
          </div>
        </div>
        {pdf && <p className="hint">{pdf}</p>}
        {routine.etapes.length === 0 ? <p className="hint">No step yet: search a pictogram below and click it to add it.</p> : (
          <ol className="rtn-bande">
            {routine.etapes.map((e, i) => (
              <li key={e.id} className="rtn-carte">
                <span className="rtn-numero">{i + 1}</span>
                <img src={urlPicto(e.picto)} alt="" />
                <ChampTexte valeur={e.texte} titre="Word under the pictogram"
                  onValider={(texte) => void changer((r) => ({ ...r, etapes: r.etapes.map((x) => (x.id === e.id ? { ...x, texte } : x)) }))} />
                <div className="rtn-outils">
                  <button className="btn-ghost" title="Move left" disabled={i === 0} onClick={() => deplacer(i, -1)}>←</button>
                  <button className="btn-ghost" title="Remove step" onClick={() => void changer((r) => ({ ...r, etapes: r.etapes.filter((x) => x.id !== e.id) }))}>✕</button>
                  <button className="btn-ghost" title="Move right" disabled={i === routine.etapes.length - 1} onClick={() => deplacer(i, 1)}>→</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="rtn-bloc">
        <h3>Add a step</h3>
        <Recherche onChoisir={(p) => void changer((r) => ({ ...r, etapes: [...r.etapes, { id: nouvelId(), picto: p.id, texte: majuscule(p.mot) }] }))} />
      </section>
    </>
  );
}

function NouvelleRoutine({ modifier, onAjout }: { modifier: Modifier; onAjout: (id: string) => void }) {
  const [nom, setNom] = useState("");
  return (
    <form className="rtn-form" onSubmit={(e) => {
      e.preventDefault();
      const n = nom.trim();
      if (!n) return;
      const id = nouvelId();
      void modifier((d) => ({ ...d, routines: [...d.routines, { id, nom: n, etapes: [] }] }));
      setNom("");
      onAjout(id);
    }}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Routine name (ex. Le matin)" autoFocus />
      <button type="submit" className="btn-primary" disabled={!nom.trim()}>Create routine</button>
    </form>
  );
}

export function RoutinesTool({ tool }: ToolScreenProps) {
  const c = useRoutines();
  const d = c.donnees;
  const [choisie, setChoisie] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"routine" | "nouvelle" | "reglages">("routine");
  const [affichee, setAffichee] = useState<Routine | null>(null);
  const routine = d?.routines.find((r) => r.id === choisie) ?? d?.routines[0];

  return (
    <div className="outil">
      <header className="outil-barre">
        <div className="toolbar-title"><h2>{tool.name}</h2></div>
        <div className="toolbar-actions"><PinButton /></div>
      </header>

      {!d ? <EtatSansDonnees c={c} /> : (
        <div className="rtn-page">
          {c.horsLigne && <p className="rtn-erreur">No connection to Nextcloud: showing the last known copy, changes cannot be saved.</p>}
          {c.erreur && <p className="rtn-erreur">{c.erreur}</p>}
          <nav className="rtn-onglets">
            {d.routines.map((r) => (
              <button key={r.id} className={onglet === "routine" && r.id === routine?.id ? "btn-primary" : ""}
                onClick={() => { setChoisie(r.id); setOnglet("routine"); }}>{r.nom}</button>
            ))}
            <button className={onglet === "nouvelle" || !routine ? "btn-primary" : ""} onClick={() => setOnglet("nouvelle")}>+ New</button>
            <button className={onglet === "reglages" ? "btn-primary" : ""} onClick={() => setOnglet("reglages")}>Settings</button>
          </nav>
          {onglet === "reglages" ? (
            <section className="rtn-bloc">
              <h3>Nextcloud</h3>
              <SyncSetup id={ID} dossierParDefaut={DOSSIER} lien onChange={c.relire} />
              <p className="hint">{CREDIT} Pictograms are loaded from arasaac.org, so searching and printing need an internet connection.</p>
            </section>
          ) : onglet === "nouvelle" || !routine ? (
            <section className="rtn-bloc">
              <h3>New routine</h3>
              <NouvelleRoutine modifier={c.modifier} onAjout={(id) => { setChoisie(id); setOnglet("routine"); }} />
            </section>
          ) : (
            <Editeur key={routine.id} routine={routine} modifier={c.modifier} onAfficher={() => setAffichee(routine)} />
          )}
        </div>
      )}
      {affichee && <Affichage routine={affichee} onFermer={() => setAffichee(null)} />}
    </div>
  );
}

function EtatSansDonnees({ c }: { c: ReturnType<typeof useRoutines> }) {
  if (c.chargement) return <p className="hint">Loading…</p>;
  if (!c.dossier) {
    return (
      <div className="rtn-bloc">
        <p>Choose where <b>routines.json</b> is kept: a folder of your Nextcloud account, or a shared link someone gave you (to use the same routines in both homes). The file is never sent anywhere else.</p>
        <SyncSetup id={ID} dossierParDefaut={DOSSIER} lien onChange={c.relire} />
        {c.erreur && <p className="rtn-erreur">{c.erreur}</p>}
      </div>
    );
  }
  return c.erreur ? <p className="rtn-erreur">{c.erreur}</p> : <p className="hint">Loading…</p>;
}
