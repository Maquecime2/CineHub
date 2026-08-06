/* ============================================================
   SUIVRE LA CIBLE — où se trouve, à cet instant, ce qu'on montre

   Le trou du voile doit rester collé à un nœud qui bouge : la fenêtre
   se redimensionne, la page défile, une vue vient de changer et le nœud
   n'existe pas encore. Ce fichier ne fait que ça, pour que le moteur de
   visite n'ait à connaître qu'un rectangle.
   ============================================================ */
import { useEffect, useState } from "react";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Combien de temps on attend un nœud qui n'est pas encore monté. */
const WAIT_MS = 700;

export type TargetStatus = "waiting" | "found" | "missing";

/**
 * Renvoie la boîte de la cible et l'état de la recherche.
 *
 * `selector` nul (étape sans cible, dite « au centre ») donne
 * immédiatement `missing` avec un rectangle nul : c'est au moteur de
 * décider que cela veut dire « bulle centrée » et non « étape ratée ».
 */
export function useTourTarget(
  selector: string | null,
  /**
   * Rang de l'étape. Il n'entre dans aucun calcul, et il est pourtant
   * nécessaire : deux étapes voisines peuvent viser le MÊME sélecteur
   * dans deux vues différentes — le mur de la vidéothèque puis celui de
   * la watchlist. Sans lui, la dépendance ne change pas, la recherche
   * ne se relance pas, et l'on continue de mesurer un nœud démonté.
   */
  nonce: number
): {
  rect: Rect | null;
  status: TargetStatus;
} {
  const [rect, setRect] = useState<Rect | null>(null);
  const [status, setStatus] = useState<TargetStatus>(selector ? "waiting" : "missing");

  useEffect(() => {
    if (!selector) {
      setRect(null);
      setStatus("missing");
      return;
    }

    setRect(null);
    setStatus("waiting");

    let raf = 0;
    let node: Element | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    const deadline = Date.now() + WAIT_MS;

    /** Vrai quand la cible a une taille, c'est-à-dire quand il y a
        quelque chose à entourer. Renvoie faux tant qu'elle est plate. */
    const measure = (): boolean => {
      if (!node || cancelled) return false;
      const r = node.getBoundingClientRect();
      /* Un nœud monté mais de taille nulle (une vue encore en train de
         s'ouvrir, un bloc replié) n'est pas une cible montrable. */
      if (r.width < 1 && r.height < 1) return false;
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setStatus("found");
      return true;
    };

    /* L'ATTENTE. Après un changement de vue, React n'a pas encore posé
       le nœud : chercher une seule fois échouerait à tous les coups sur
       les étapes qui naviguent. On cherche donc à chaque image, jusqu'à
       l'échéance — au-delà, la cible est déclarée absente et le moteur
       saute l'étape si elle est facultative.

       L'ÉCHÉANCE VAUT AUSSI APRÈS AVOIR TROUVÉ LE NŒUD. Trouver n'est
       pas mesurer : un nœud présent mais plat laissait la recherche en
       « on attend » pour toujours, et la visite se plantait là sans un
       mot — un voile opaque sur une bulle qui ne pointe rien. */
    const hunt = () => {
      if (cancelled) return;
      node ||= document.querySelector(selector);
      if (node && !observer) {
        node.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        observer = new ResizeObserver(measure);
        observer.observe(node);
      }
      if (node && measure()) return;
      if (Date.now() > deadline) {
        setStatus("missing");
        return;
      }
      raf = requestAnimationFrame(hunt);
    };
    hunt();

    /* `capture` : le défilement se produit souvent dans un conteneur
       interne (la liste d'onglets, le mur), et un écouteur posé sur la
       fenêtre sans capture ne le verrait jamais. */
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selector, nonce]);

  return { rect, status };
}
