// Banque de pictogrammes ARASAAC (api.arasaac.org), appelee directement par la webview :
// l'API et les images repondent avec Access-Control-Allow-Origin: *.

/** Langue des mots-cles cherches et du mot propose sous le pictogramme. */
const LANGUE = "fr";
const MAX_RESULTATS = 40;

export interface Picto {
  id: number;
  mot: string;
}

/** 300 px pour l'ecran, 500 px pour l'impression (~40 mm par case a 300 dpi). */
export const urlPicto = (id: number, taille: 300 | 500 = 300) =>
  `https://static.arasaac.org/pictograms/${id}/${id}_${taille}.png`;

/** Mention exigee par la licence, imprimee sur chaque PDF et affichee dans l'app. */
export const CREDIT =
  "Pictograms: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC BY-NC-SA. Owner: Government of Aragón (Spain).";

export async function chercher(terme: string, signal?: AbortSignal): Promise<Picto[]> {
  const r = await fetch(`https://api.arasaac.org/v1/pictograms/${LANGUE}/search/${encodeURIComponent(terme)}`, { signal });
  if (r.status === 404) return []; // ARASAAC repond 404 quand rien ne correspond
  if (!r.ok) throw new Error(`ARASAAC error ${r.status}`);
  const liste = (await r.json()) as { _id: number; keywords?: { keyword: string }[] }[];
  return liste.slice(0, MAX_RESULTATS).map((p) => ({ id: p._id, mot: p.keywords?.[0]?.keyword ?? terme }));
}
