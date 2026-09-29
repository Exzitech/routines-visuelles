import { CREDIT, urlPicto } from "./arasaac";
import type { Routine } from "./donnees";
import { pdfImage } from "./pdf";

// Page A4 paysage dessinee a 200 dpi : nette a l'impression, JPEG de quelques centaines de Ko.
const DPI = 200;
const MM = DPI / 25.4;
const PAGE_MM = { l: 297, h: 210 };
/** Au-dela, la bande passe sur plusieurs rangees equilibrees (7 etapes -> 4 + 3). */
export const PAR_RANGEE = 6;
const ENCRE = "#222";

function charger(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // sinon le canvas serait "souille" et non exportable
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`Pictogram not loaded (${url}): no connection to ARASAAC?`));
    img.src = url;
  });
}

/** Coupe `texte` en `max` lignes au plus, la derniere tronquee avec "…" si besoin. */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number, max: number): string[] {
  const res: string[] = [];
  let courante = "";
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (!courante || ctx.measureText(essai).width <= largeur) courante = essai;
    else { res.push(courante); courante = mot; }
  }
  if (courante) res.push(courante);
  if (res.length > max) res.splice(max - 1, res.length, res.slice(max - 1).join(" "));
  const d = res.length - 1;
  if (d >= 0 && ctx.measureText(res[d]).width > largeur) {
    while (res[d].length > 1 && ctx.measureText(`${res[d]}…`).width > largeur) res[d] = res[d].slice(0, -1);
    res[d] = `${res[d].trimEnd()}…`;
  }
  return res;
}

function dessiner(ctx: CanvasRenderingContext2D, r: Routine, images: HTMLImageElement[], W: number, H: number) {
  const marge = 12 * MM, ecart = 6 * MM, pad = 4 * MM;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = ENCRE;
  ctx.font = `bold ${9 * MM}px sans-serif`;
  ctx.fillText(r.nom, W / 2, marge, W - 2 * marge);

  const n = r.etapes.length;
  const rangees = Math.ceil(n / PAR_RANGEE);
  const cols = Math.ceil(n / rangees);
  const haut = marge + 18 * MM, bas = H - marge - 6 * MM;
  const largeur = (W - 2 * marge - (cols - 1) * ecart) / cols;
  const hauteurRangee = (bas - haut - (rangees - 1) * ecart) / rangees;
  const police = Math.min(Math.max(largeur * 0.11, 4 * MM), 8 * MM);
  const texteH = 2 * police * 1.2;
  const cote = Math.min(largeur - 2 * pad, hauteurRangee - 2.5 * pad - texteH);
  const carteH = cote + 2.5 * pad + texteH;
  const rayon = Math.max(3.5 * MM, police * 0.7);

  r.etapes.forEach((e, i) => {
    const rangee = Math.floor(i / cols), col = i % cols;
    const dansRangee = Math.min(cols, n - rangee * cols);
    // Rangee incomplete centree ; cartes centrees verticalement dans leur rangee.
    const x = (W - dansRangee * largeur - (dansRangee - 1) * ecart) / 2 + col * (largeur + ecart);
    const y = haut + rangee * (hauteurRangee + ecart) + (hauteurRangee - carteH) / 2;

    ctx.lineWidth = 0.6 * MM;
    ctx.strokeStyle = ENCRE;
    ctx.beginPath();
    ctx.roundRect(x, y, largeur, carteH, 3 * MM);
    ctx.stroke();
    ctx.drawImage(images[i], x + (largeur - cote) / 2, y + pad, cote, cote);

    // Numero de l'etape, a cheval sur le coin de la carte.
    ctx.fillStyle = ENCRE;
    ctx.beginPath();
    ctx.arc(x, y, rayon, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${rayon * 1.2}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y);

    ctx.fillStyle = ENCRE;
    ctx.font = `${police}px sans-serif`;
    ctx.textBaseline = "top";
    lignes(ctx, e.texte, largeur - pad, 2).forEach((l, k) => {
      ctx.fillText(l, x + largeur / 2, y + pad * 1.5 + cote + k * police * 1.2);
    });
  });

  ctx.fillStyle = "#777";
  ctx.font = `${2.6 * MM}px sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(CREDIT, W / 2, H - marge / 2, W - 2 * marge);
}

/** PDF A4 paysage de la routine ; les pictos sont recharges en 500 px depuis ARASAAC. */
export async function pdfRoutine(r: Routine): Promise<Uint8Array> {
  if (r.etapes.length === 0) throw new Error("This routine has no step yet");
  const images = await Promise.all(r.etapes.map((e) => charger(urlPicto(e.picto, 500))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_MM.l * MM);
  canvas.height = Math.round(PAGE_MM.h * MM);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  dessiner(ctx, r, images, canvas.width, canvas.height);
  // toDataURL et non toBlob : la webview Android encode toBlob par petits morceaux pendant
  // ses temps morts, 13 s pour cette page sur un Galaxy S23, contre 0,16 s d'une traite.
  const url = canvas.toDataURL("image/jpeg", 0.92);
  if (!url.startsWith("data:image/jpeg;base64,")) throw new Error("JPEG encoding failed");
  const jpeg = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const enPoints = (mm: number) => (mm * 72) / 25.4;
  return pdfImage(jpeg, canvas.width, canvas.height, enPoints(PAGE_MM.l), enPoints(PAGE_MM.h));
}
