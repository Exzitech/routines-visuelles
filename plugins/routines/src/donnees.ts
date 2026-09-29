/** Une etape : un pictogramme ARASAAC et le mot affiche dessous. */
export interface Etape {
  id: string;
  /** Identifiant ARASAAC */
  picto: number;
  texte: string;
}

export interface Routine {
  id: string;
  nom: string;
  etapes: Etape[];
}

export interface Donnees {
  version: 1;
  /** Incremente a chaque ecriture : permet de reperer un changement venu d'un autre appareil. */
  revision: number;
  routines: Routine[];
}

export const vide = (): Donnees => ({ version: 1, revision: 0, routines: [] });

/** Lit le fichier de synchro ; leve une erreur explicite si le contenu n'est pas reconnu. */
export function analyser(texte: string): Donnees {
  const d = JSON.parse(texte) as Partial<Donnees>;
  if (!d || d.version !== 1 || !Array.isArray(d.routines)) {
    throw new Error("routines.json is not a valid routines file (unknown version or missing fields)");
  }
  return { ...vide(), ...d } as Donnees;
}

export const nouvelId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
