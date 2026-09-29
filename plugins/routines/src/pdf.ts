// PDF d'une page faite d'une seule image JPEG : tout le dessin (pictos, textes accentues)
// est fait dans un canvas, donc aucune police ni bibliotheque PDF n'est necessaire.

const enc = new TextEncoder();
const pt = (n: number) => n.toFixed(2);

/**
 * `jpeg` fait `px` x `py` pixels et couvre toute la page de `largeur` x `hauteur` points
 * (1 pt = 1/72 pouce). Les decalages de la table xref sont ceux des octets reellement ecrits.
 */
export function pdfImage(jpeg: Uint8Array, px: number, py: number, largeur: number, hauteur: number): Uint8Array {
  const parts: Uint8Array[] = [];
  const decalages: number[] = [];
  let taille = 0;
  const ajouter = (x: string | Uint8Array) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    parts.push(b);
    taille += b.length;
  };
  const objet = (n: number, debut: string, flux?: Uint8Array) => {
    decalages[n] = taille;
    ajouter(`${n} 0 obj\n${debut}\n`);
    if (flux) { ajouter("stream\n"); ajouter(flux); ajouter("\nendstream\n"); }
    ajouter("endobj\n");
  };

  // Octets > 127 apres l'en-tete : signale un fichier binaire aux outils de transfert.
  ajouter("%PDF-1.4\n");
  ajouter(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const contenu = enc.encode(`q ${pt(largeur)} 0 0 ${pt(hauteur)} 0 0 cm /Im0 Do Q`);
  objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objet(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objet(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(largeur)} ${pt(hauteur)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  objet(4, `<< /Type /XObject /Subtype /Image /Width ${px} /Height ${py} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  objet(5, `<< /Length ${contenu.length} >>`, contenu);

  const xref = taille;
  const entrees = decalages.slice(1).map((d) => `${String(d).padStart(10, "0")} 00000 n \n`).join("");
  ajouter(`xref\n0 ${decalages.length}\n0000000000 65535 f \n${entrees}`);
  ajouter(`trailer\n<< /Size ${decalages.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const sortie = new Uint8Array(taille);
  let i = 0;
  for (const p of parts) { sortie.set(p, i); i += p.length; }
  return sortie;
}

/** Nom de fichier ASCII (le hub ne garde que [A-Za-z0-9._-]) : "Matin école" -> "Matin-ecole.pdf". */
export const nomFichier = (nom: string) =>
  (nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "routine") + ".pdf";
