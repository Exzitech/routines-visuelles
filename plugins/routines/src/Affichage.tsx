import { useEffect, useState } from "react";
import { urlPicto } from "./arasaac";
import type { Routine } from "./donnees";

/**
 * Plein ecran pour l'enfant : une grande etape a la fois, toucher n'importe ou passe a la
 * suivante ; la bande du haut montre les etapes faites (estompees) et celle en cours.
 */
export function Affichage({ routine, onFermer }: { routine: Routine; onFermer: () => void }) {
  const [i, setI] = useState(0);
  const n = routine.etapes.length;
  const etape = routine.etapes[i];
  const suivante = () => setI((x) => Math.min(x + 1, n));
  const precedente = () => setI((x) => Math.max(x - 1, 0));

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
      else if (e.key === "ArrowLeft") precedente();
      else if (e.key === "ArrowRight" || e.key === " ") suivante();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  return (
    <div className="rtn-plein" onClick={suivante}>
      <div className="rtn-plein-haut" onClick={(e) => e.stopPropagation()}>
        <button className="rtn-plein-btn" onClick={precedente} disabled={i === 0} title="Previous step">←</button>
        <ol className="rtn-suivi">
          {routine.etapes.map((e, k) => (
            <li key={e.id} className={k < i ? "rtn-fait" : k === i ? "rtn-courante" : ""}><img src={urlPicto(e.picto)} alt={e.texte} /></li>
          ))}
        </ol>
        <button className="rtn-plein-btn" onClick={onFermer} title="Close">✕</button>
      </div>
      {etape ? (
        <figure className="rtn-grande">
          <img src={urlPicto(etape.picto, 500)} alt="" />
          <figcaption>{etape.texte}</figcaption>
        </figure>
      ) : (
        <div className="rtn-bravo" onClick={(e) => e.stopPropagation()}>
          <span>✓</span>
          <button className="rtn-plein-btn" onClick={() => setI(0)} title="Start again">↺</button>
        </div>
      )}
    </div>
  );
}
