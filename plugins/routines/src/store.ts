import { useCallback, useEffect, useRef, useState } from "react";
import { sync } from "../../shared/hub";
import { analyser, vide, type Donnees } from "./donnees";

export const ID = "routines";
const FICHIER = "routines.json";
const RAFRAICHIR_MS = 60_000;

export interface Routines {
  /** null tant que le fichier n'est pas charge (ou sans espace de synchro). */
  donnees: Donnees | null;
  /** Ou est le fichier (dossier Nextcloud ou lien) ; null tant qu'il n'est pas choisi. */
  dossier: string | null;
  /** Nextcloud injoignable : derniere copie connue, en lecture seule. */
  horsLigne: boolean;
  chargement: boolean;
  erreur: string | null;
  /** A appeler apres un changement d'espace (SyncSetup). */
  relire(): Promise<void>;
  /** Applique `f` a la derniere version du fichier (relue juste avant) puis l'ecrit. */
  modifier(f: (d: Donnees) => Donnees): Promise<void>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Routines stockees sur Nextcloud (routines.json), meme protocole que Child Growth : le fichier est
 * la source de verite, chaque modification relit le fichier et n'ecrit que s'il n'a pas change
 * entre-temps (voir sync.modifier), donc une routine modifiee sur un autre appareil n'est jamais
 * ecrasee. La revision ne sert qu'a savoir si l'affichage doit etre rafraichi.
 */
export function useRoutines(): Routines {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [dossier, setDossier] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Serialise les ecritures : deux clics rapides ne se melangent pas.
  const file = useRef<Promise<void>>(Promise.resolve());

  const recharger = useCallback(async () => {
    try {
      const lu = await sync.lire(ID, FICHIER);
      const d = lu ? analyser(lu.texte) : vide();
      setDonnees((courant) => (courant && courant.revision === d.revision ? courant : d));
      setHorsLigne(!!lu?.horsLigne);
      setErreur(null);
    } catch (e) {
      setErreur(message(e));
    }
  }, []);

  const relire = useCallback(async () => {
    try {
      const { espace } = await sync.etat(ID);
      const ou = espace ? (espace.mode === "compte" ? espace.dossier : espace.lien) : null;
      setDossier(ou);
      if (ou) await recharger();
    } catch (e) {
      setErreur(message(e));
    } finally {
      setChargement(false);
    }
  }, [recharger]);

  useEffect(() => { void relire(); }, [relire]);

  useEffect(() => {
    if (!dossier) return;
    const minuteur = window.setInterval(recharger, RAFRAICHIR_MS);
    window.addEventListener("focus", recharger);
    return () => { window.clearInterval(minuteur); window.removeEventListener("focus", recharger); };
  }, [dossier, recharger]);

  const modifier = useCallback((f: (d: Donnees) => Donnees) => {
    const tache = file.current.then(async () => {
      try {
        let suivant: Donnees | null = null;
        await sync.modifier(ID, FICHIER, (texte) => {
          suivant = f(texte === null ? vide() : analyser(texte));
          suivant.revision += 1;
          return JSON.stringify(suivant, null, 2);
        });
        setDonnees(suivant);
        setHorsLigne(false);
        setErreur(null);
      } catch (e) {
        setErreur(`Not saved: ${message(e)}`);
      }
    });
    file.current = tache;
    return tache;
  }, []);

  return { donnees, dossier, horsLigne, chargement, erreur, relire, modifier };
}
