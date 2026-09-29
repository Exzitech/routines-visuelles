import { describe, expect, it } from "vitest";
import { nomFichier, pdfImage } from "../src/pdf";

const texte = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("pdfImage", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x0a, 0xff, 0xd9]);
  const pdf = texte(pdfImage(jpeg, 20, 10, 841.89, 595.28));

  it("a une table xref dont chaque entree pointe sur son objet", () => {
    const xref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.startsWith("xref", xref)).toBe(true);
    const entrees = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entrees).toHaveLength(5);
    entrees.forEach((d, i) => expect(pdf.startsWith(`${i + 1} 0 obj`, d)).toBe(true));
  });

  it("declare la longueur exacte du JPEG et la taille de page", () => {
    expect(pdf).toContain("/Width 20 /Height 10");
    expect(pdf).toContain(`/Length ${jpeg.length} >>\nstream\n${texte(jpeg)}\nendstream`);
    expect(pdf).toContain("/MediaBox [0 0 841.89 595.28]");
  });
});

describe("nomFichier", () => {
  it("garde un nom ASCII lisible", () => {
    expect(nomFichier("Matin école !")).toBe("Matin-ecole.pdf");
    expect(nomFichier("✨")).toBe("routine.pdf");
  });
});
