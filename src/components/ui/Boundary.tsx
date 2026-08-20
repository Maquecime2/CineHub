/* ============================================================
   LA DIGUE — ce qui reste à l'écran quand une vue tombe
   ============================================================

   IL N'Y EN AVAIT AUCUNE DANS TOUT LE PROJET. Pas un
   `componentDidCatch`, pas une frontière d'erreur : une exception dans
   le rendu d'une vue démonte l'arbre React entier et laisse une PAGE
   BLANCHE. Pas un message, pas un rail, pas un bouton pour revenir —
   juste du blanc, et un rechargement à deviner.

   LE CAS N'EST PAS THÉORIQUE. Dix des treize vues sont chargées
   paresseusement : un déploiement pendant qu'un onglet est ouvert
   invalide les morceaux, le `import()` suivant échoue, et le
   `<Suspense>` ne rattrape pas un rejet — il ne connaît que l'attente.
   Un réseau coupé au mauvais moment fait la même chose.

   ELLE EST DONC POSÉE À DEUX ENDROITS, et pour deux raisons
   différentes : autour de la colonne de vue, pour qu'une vue fautive ne
   coûte pas le rail ni les couches globales ; et autour de l'application
   entière, parce que la première ne se protège pas elle-même.

   ELLE NE RÉPARE RIEN, ET NE PRÉTEND PAS LE FAIRE. Elle montre ce qui
   s'est passé et propose de réessayer, ce qui remonte un composant neuf
   — suffisant pour un morceau qui n'était pas arrivé, inutile pour un
   défaut de rendu, et honnête dans les deux cas.

   C'EST UNE CLASSE, ET IL N'Y A PAS LE CHOIX. React n'expose
   `getDerivedStateFromError` que sur un composant de classe ; c'est la
   seule de tout le projet, et elle l'est pour cette raison-là.
   ============================================================ */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { inked } from "../../theme/styles";
/* A CLASS HAS NO HOOK. React only exposes `getDerivedStateFromError`
   here, so the catalogue is read from the instance rather than from
   `useTranslation` — the screen that says a view fell must not itself
   depend on a hook it cannot call. */
import i18n from "../../i18n";

interface Props {
  children: ReactNode;
  /** Ce qui est tombé, pour que le message le nomme. */
  what?: string;
  /* CHANGER CETTE CLÉ REMET LA DIGUE À ZÉRO. Sans elle, une vue tombée
     resterait tombée après qu'on a changé d'onglet : l'état d'erreur
     survivrait à ce qui l'a causé, et le rail deviendrait inerte. */
  resetKey?: string;
}

interface State {
  fallen: Error | null;
  /** La clé au moment de la chute, pour savoir quand elle a bougé. */
  at: string | undefined;
}

export class Boundary extends Component<Props, State> {
  state: State = { fallen: null, at: undefined };

  static getDerivedStateFromError(fallen: Error): Partial<State> {
    return { fallen };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.fallen && state.at !== undefined && props.resetKey !== state.at) {
      return { fallen: null, at: props.resetKey };
    }
    if (!state.fallen) return { at: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    /* LA CONSOLE GARDE LA PILE, l'écran garde la phrase. Les deux sont
       nécessaires : la phrase est pour la personne devant, la pile est
       la seule chose qui permette de réparer. */
    console.error("[cinehub] une vue est tombée", error, info.componentStack);
  }

  render(): ReactNode {
    const { fallen } = this.state;
    if (!fallen) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          margin: "40px auto",
          maxWidth: 520,
          padding: "22px 24px 20px",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${C.burgundy}`,
          boxShadow: "2px 4px 12px rgba(20,14,8,0.22)",
        }}
      >
        <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 21, color: C.ink }}>
          {this.props.what ?? i18n.t("boundary.title")}
        </div>
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 8 }}>
          {i18n.t("boundary.body")}
        </div>
        {/* LE DÉTAIL EST LÀ, ET IL EST REPLIÉ. Une pile d'appels en
            grand sur un écran de lecture n'aide personne ; absente,
            elle oblige à ouvrir la console pour rapporter quoi que ce
            soit. */}
        <details style={{ marginTop: 10 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: C.inkFaded,
            }}
          >
            {i18n.t("boundary.detail")}
          </summary>
          <pre
            style={{
              margin: "6px 0 0",
              padding: 8,
              overflowX: "auto",
              background: alpha(C.ink, 0.05),
              fontFamily: F.mono,
              fontSize: 11,
              color: C.ink,
              whiteSpace: "pre-wrap",
            }}
          >
            {fallen.message}
          </pre>
        </details>
        <button
          onClick={() => this.setState({ fallen: null })}
          style={{ ...inked(C.ink), marginTop: 14 }}
        >
          {i18n.t("common.retry")}
        </button>
      </div>
    );
  }
}
