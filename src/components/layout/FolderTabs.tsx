/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { type ComponentType } from "react";
import {
  Pin,
  Palette,
  UserRound,
  HelpCircle,
  Clapperboard,
  Bookmark,
  Users,
  Users2,
  ListChecks,
  Compass,
  Sparkles,
  CalendarDays,
  NotebookPen,
  FolderInput,
  Settings,
  Search,
  KeyRound,
} from "lucide-react";
import { C, alpha } from "../../theme/tokens";
import { useViewport } from "../../hooks/useViewport";

/** Les vues joignables depuis les onglets. `detail` s'ouvre depuis une fiche. */
export type View =
  | "library"
  | "watchlist"
  | "generique"
  | "reco"
  | "constellation"
  | "notebook"
  | "import"
  | "fil"
  | "listes"
  | "detail"
  | "almanac"
  | "skinlab";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
  /** Ouvre la recherche qui traverse tout le classeur. */
  onSearch: () => void;
  /** Ouvre le choix de la peau du site. */
  onSkin: () => void;
  /** Ouvre le menu de la visite guidée. */
  onHelp: () => void;
  /** Ouvre le réglage de la clé TMDB. */
  onKey: () => void;
  /** Le tiroir du compte et de la synchronisation. */
  onCompte: () => void;
  /**
   * L'état de la synchronisation, pour le pastiller. `null` quand il
   * n'y a pas de serveur : l'action n'est alors même pas montée.
   */
  synchro: "à-jour" | "en-cours" | "en-attente" | "erreur" | "hors-compte" | "absent";
}

/* L'ICÔNE N'EST PAS UN ORNEMENT : c'est ce qui reste de l'onglet quand
   la fenêtre est trop basse pour ses mots. Elle doit donc se lire seule,
   et désigner la vue et non sa jolie métaphore. */
const TABS: { key: View; label: string; color: string; icon: ComponentType<{ size?: number }> }[] =
  [
    { key: "library", label: "Vidéothèque", color: C.burgundy, icon: Clapperboard },
    { key: "watchlist", label: "À voir", color: C.ochre, icon: Bookmark },
    /* Le Générique regarde la même collection sous un autre angle : il est
     du groupe du fonds, à côté des deux murs, et non des outils. */
    { key: "generique", label: "Générique", color: C.plum, icon: Users },
    { key: "reco", label: "Découvertes", color: C.vermillion, icon: Compass },
    { key: "constellation", label: "Constellation", color: C.cobalt, icon: Sparkles },
    { key: "almanac", label: "Almanach", color: C.moss, icon: CalendarDays },
    { key: "notebook", label: "Carnet", color: C.pine, icon: NotebookPen },
    { key: "import", label: "Import Letterboxd", color: C.slate, icon: FolderInput },
    /* LE FIL EST LE DERNIER ONGLET, et pas le premier : le classeur
       reste une videotheque personnelle, et ce qu'on regarde chez les
       autres vient apres ce qu'on a chez soi. */
    { key: "fil", label: "Le fil", color: C.cobalt, icon: Users2 },
    /* Les listes et les defis viennent apres le fil : on regarde ce que
       font les autres avant de se lancer quelque chose avec eux. */
    { key: "listes", label: "Listes et défis", color: C.moss, icon: ListChecks },
  ];

/* L'onglet de contrôle des peaux n'est pas une vue du produit : il ne
   paraît qu'en développement, et le build de production ne l'emporte
   même pas — la condition est statique, donc l'import de la planche
   tombe au secouage d'arbre. */
const DEV_TABS: typeof TABS = import.meta.env.DEV
  ? /* En encre et non dans l'une des huit teintes : les onglets du
       produit sont pris, et un outil ne doit pas se déguiser en vue. */
    [{ key: "skinlab", label: "Peaux ⚙", color: C.ink, icon: Settings }]
  : [];

const DIMMED = "saturate(0.65) brightness(0.92)";

type Tab = (typeof TABS)[number];

/* UN ONGLET — UNE PASTILLE À ICÔNE.

   Les onglets portaient leur nom, écrit à la verticale. Huit noms font
   plus de neuf cents pixels, une peau en capitales à chasse allongée les
   rallonge encore, et le rail se mettait à défiler : une barre de
   défilement sur une tranche de classeur, ce qui ne ressemble à rien.

   L'icône règle la question au lieu de la repousser : huit pastilles
   font moins de trois cents pixels, elles tiennent dans n'importe quelle
   fenêtre, et aucune peau ne peut les rallonger. Le nom n'est pas perdu
   — il passe dans l'infobulle et dans `aria-label`, sans quoi le rail
   entier deviendrait muet pour un lecteur d'écran. */
function Onglet({
  t,
  active,
  onClick,
  phone,
}: {
  t: Tab;
  active: boolean;
  onClick: () => void;
  /* AU TELEPHONE, CE N'EST PLUS UN ONGLET DE CLASSEUR.

     La pastille tire son dessin de la tranche contre laquelle elle bute :
     arrondie a droite seulement, decalee de six pixels vers la gauche
     quand elle dort, et qui avance quand on la choisit. Couchee au bas
     de l'ecran, cette grammaire ne veut plus rien dire — il n'y a plus
     de tranche a gauche, et le decalage lit alors comme un defaut
     d'alignement.

     Elle redevient donc ce qu'elle est vraiment a cet endroit : un
     jeton, arrondi de partout, assez large pour un pouce. Quarante
     pixels et non trente-deux : c'est le plancher en dessous duquel une
     cible se rate une fois sur trois. */
  phone: boolean;
}) {
  const Icon = t.icon;
  return (
    <button
      data-tour={`tab-${t.key}`}
      data-tab-onglet
      onClick={onClick}
      title={t.label}
      aria-label={t.label}
      aria-current={active ? "page" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        boxSizing: "border-box",
        width: phone ? 40 : 32,
        height: phone ? 40 : 32,
        /* ET QUI SE TASSENT PLUTÔT QUE DE DÉBORDER.

           Huit pastilles tiennent dans toute fenêtre raisonnable, mais
           « raisonnable » n'est pas une garantie : sous une certaine
           hauteur, la dernière passerait sous le bord, et `overflow:
           clip` la couperait en silence — un onglet invisible et
           injoignable, ce qui est pire qu'un onglet serré.

           En colonne flexible, un objet se rétracte de lui-même quand la
           place manque. Le plancher est l'icône elle-même : on ne
           descend pas sous ce qui se lit. */
        flexShrink: phone ? 0 : 1,
        minHeight: phone ? 40 : 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // carton teinté dans la masse, pas un aplat : reflet en haut, tranche sombre en bas
        /* `${t.color}cc` collait un canal alpha derriere une
           couleur. Depuis que les jetons sont des renvois a des
           variables CSS, ce collage ne veut plus rien dire et le
           degrade entier etait rejete — les onglets perdaient
           leur relief sans un mot. */
        background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${alpha(t.color, 0.8)})`,
        filter: active ? "none" : DIMMED,
        color: C.card,
        borderRadius: phone ? "var(--tag-radius)" : "0 var(--tag-radius) var(--tag-radius) 0",
        /* L'onglet choisi avance vers la droite, sur le rail. Couche en
           bas il ne peut plus avancer : il se cerne alors d'un filet de
           carton clair, qui le detache de la barre sans changer sa
           couleur — c'est la meme chose que dit l'avancee, dite
           autrement. */
        boxShadow: active
          ? phone
            ? `0 0 0 2px ${C.card}, 0 2px 8px rgba(0,0,0,0.35)`
            : `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
          : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
        marginLeft: phone || active ? 0 : -6,
        /* Les durées passent par les jetons de mouvement : le bloc
           `prefers-reduced-motion` les met à zéro tout seul. */
        transition: "margin var(--motion-fast) var(--motion-ease), filter var(--motion-fast) ease",
      }}
      /* LE SURVOL N'EXISTE PAS SOUS UN DOIGT, MAIS LE NAVIGATEUR FAIT
         SEMBLANT : il emet un survol au moment du contact, et l'onglet
         restait ensuite avance et rallume jusqu'au prochain contact
         ailleurs — huit onglets tous eclaires, plus aucun choisi. */
      onMouseEnter={(e) => {
        if (!active && !phone) {
          e.currentTarget.style.marginLeft = "0px";
          e.currentTarget.style.filter = "none";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !phone) {
          e.currentTarget.style.marginLeft = "-6px";
          e.currentTarget.style.filter = DIMMED;
        }
      }}
    >
      <Icon size={16} />
    </button>
  );
}

/* LA HAUTEUR DE LA BARRE DU BAS, hors encoche. Le meme chiffre est
   repris dans `FONT_IMPORT` pour creuser le pied de la colonne de vue :
   une media query n'accepte pas de `var()`, et le doublon est le prix de
   cette limite. Si l'un change, l'autre change. */
const BAR_H = 58;

/* LES PETITS RÉGLAGES DE TOUT — la peau, la clé, le compte, la visite.

   Ils ne sont le réglage d'AUCUNE vue, c'est celui de toutes : d'où le
   pied du rail, et non un onglet. Discrets, parce qu'on les touche deux
   fois et qu'on les côtoie tous les jours.

   Une seule pastille écrite une seule fois : les quatre portaient le
   même bloc de style recopié, et la suivante l'aurait recopié une fois
   de plus — autant d'occasions de diverger sans le vouloir. La
   démonstration a eu lieu : le rail au doigt et la clé TMDB sont
   arrivés chacun de son côté, et ont réécrit les mêmes boutons.

   D'où `doigt` : au téléphone ces pastilles descendent dans la barre du
   bas, où 26 px ne se visent pas. Le paramètre vit ICI plutôt qu'à
   chaque appel, sinon la prochaine pastille ajoutée l'oubliera.

   `marque` porte la pastille de synchronisation — la seule chose qu'un
   de ces boutons ait à dire sans qu'on l'ouvre. */
function ActionRonde({
  onClick,
  label,
  tour,
  icon: Icon,
  doigt = false,
  marque,
}: {
  onClick: () => void;
  label: string;
  tour: string;
  icon: ComponentType<{ size?: number }>;
  doigt?: boolean;
  marque?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      title={label}
      aria-label={label}
      style={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        marginLeft: doigt ? 0 : 8,
        width: doigt ? 40 : 26,
        height: doigt ? 40 : 26,
        borderRadius: "50%",
        color: C.inkFaded,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${C.line}`,
        transition: "color var(--motion-fast) ease, border-color var(--motion-fast) ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = C.burgundy;
        e.currentTarget.style.borderColor = C.burgundy;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = C.inkFaded;
        e.currentTarget.style.borderColor = C.line;
      }}
    >
      <Icon size={13} />
      {marque && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: doigt ? 6 : 1,
            right: doigt ? 6 : 1,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: marque,
          }}
        />
      )}
    </button>
  );
}

export function FolderTabs({
  view,
  setView,
  onAdd,
  onSearch,
  onSkin,
  onHelp,
  onKey,
  onCompte,
  synchro,
}: FolderTabsProps) {
  const tabs = [...TABS, ...DEV_TABS];
  /* LE RAIL SE COUCHE PLUTOT QU'IL NE DISPARAIT.

     Sur la tranche gauche d'un classeur, huit pastilles empilees et
     quatre actions au pied tiennent dans quarante-six pixels de large.
     Sur un telephone tenu d'une main, cette colonne mange un huitieme
     de la largeur et se termine la ou le pouce n'arrive pas — le haut
     de l'ecran. La meme liste, couchee au bas de la fenetre, tombe
     exactement sous le pouce.

     RIEN NE DISPARAIT DANS L'AFFAIRE, et ce n'est pas un scrupule :
     chacun de ces boutons porte un `data-tour`, et une visite guidee
     dont la cible n'existe pas dans le document est une visite qui saute
     l'etape en silence. Les douze cibles restent donc montees ; ce sont
     l'axe et les mesures qui changent. */
  const { phone } = useViewport();

  return (
    <div
      style={{
        width: phone ? 0 : 46,
        flexShrink: 0,
        position: "relative",
        /* LA BARRE DU BAS PERDAIT SON EGALITE, ET UNE EGALITE SE PERD
           TOUJOURS DU MEME COTE.

           Le rail et la colonne de vue etaient tous deux a 2. A valeur
           egale, c'est le DERNIER du document qui se peint dessus — et
           le rail est ecrit avant. Sur la tranche gauche, cela ne se
           voyait pas : le rail et la colonne ne se recouvrent nulle
           part. Couchee en bas, la barre passe SOUS la colonne qu'elle
           doit border, et tout ce qui deborde de la colonne se peint
           dessus.

           Vingt : au-dessus de la page (2), au-dessous des panneaux
           (30–45) et de tout ce qui suit — un tiroir ouvert recouvre la
           barre, la page jamais. */
        zIndex: phone ? 20 : 2,
      }}
    >
      {/* la tranche du classeur, contre laquelle les onglets butent.
          Elle ne suit pas la barre en bas : ce qu'elle dessine, c'est le
          dos d'un classeur pose debout, et un dos couche n'est plus un
          dos. */}
      {!phone && (
        <div
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            width: 5,
            background: `linear-gradient(90deg, ${alpha(C.ink, 0.28)}, ${C.paperDark})`,
            boxShadow: "inset -2px 0 4px rgba(30,20,10,0.2)",
            zIndex: 0,
          }}
        />
      )}
      {/* LE RAIL — pleine hauteur, et non plus « colle en haut ».

          Il etait `sticky` et poussait vers le bas : six onglets ecrits
          a la verticale font neuf cent cinquante pixels, et dans une
          fenetre de sept cent vingt le bouton d'ajout tombait sous le
          bord de l'ecran, injoignable. Une peau en capitales a chasse
          allongee rallonge encore chaque onglet — le defaut empirait
          avec l'habillage, ce qui est le signe qu'il n'etait pas dans
          l'habillage.

          Le rail occupe donc toute la hauteur, et les actions sont
          ancrees en bas : elles restent atteignables quels que soient le
          nombre d'onglets, la longueur de leurs noms et la peau posee.

          RIEN NE DEBORDE PLUS. Ce qui debordait, c'etait la LISTE, et
          elle defilait. Les onglets ne portent plus leurs noms ecrits
          mais une icone : huit pastilles tiennent partout, et se tassent
          plutot que de passer sous le bord — voir `Onglet`. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          boxSizing: "border-box",
          display: "flex",
          ...(phone
            ? {
                /* LA BARRE DU BAS. Elle est OPAQUE, et c'est necessaire :
                   le mur defile dessous, et une barre transparente
                   laisserait passer des affiches sous les onglets. */
                right: 0,
                bottom: 0,
                paddingBottom: "var(--safe-bottom)",
                paddingLeft: "max(8px, var(--safe-left))",
                paddingRight: "max(8px, var(--safe-right))",
                height: `calc(${BAR_H}px + var(--safe-bottom))`,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                background: C.paperDark,
                borderTop: `1px solid ${C.line}`,
                boxShadow: `0 -3px 10px ${alpha(C.ink, 0.16)}`,
              }
            : {
                top: 0,
                bottom: 0,
                width: 46,
                paddingTop: 30,
                paddingBottom: 14,
                flexDirection: "column",
                alignItems: "flex-start",
              }),
        }}
      >
        <div
          data-tab-rail
          style={{
            /* `minHeight: 0` est ce qui autorise vraiment le retrait :
               sans lui, un enfant flexible refuse de descendre sous la
               taille de son contenu. */
            flex: "1 1 auto",
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            gap: 6,
            ...(phone
              ? {
                  /* ICI, ON DEFILE — ET C'EST L'INVERSE DU RAIL.

                     Sur la tranche, rien ne devait deborder : une barre
                     de defilement sur le dos d'un classeur ne ressemble
                     a rien, et huit pastilles empilees tiennent dans
                     toute fenetre. Couchees, huit pastilles de quarante
                     pixels font trois cent soixante-huit, et les quatre
                     actions en prennent deux cents de plus : sur une
                     fenetre de trois cent quatre-vingt-dix, ca ne tient
                     pas, et ca ne tiendra jamais.

                     Le rangement horizontal a, lui, un geste evident au
                     doigt — on balaie. Sa barre reste cachee
                     (`[data-tab-rail]`, plus haut dans les jetons), le
                     balayage non. */
                  overflowX: "auto",
                  overflowY: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                }
              : {
                  /* `clip` et non `hidden` : on ne veut aucun axe de
                     defilement, seulement que rien ne bave a droite. Les
                     onglets glissent de six pixels au survol et portent
                     une ombre — d'ou la marge, pour ne rogner ni l'un ni
                     l'autre. */
                  overflow: "clip",
                  paddingRight: 12,
                  flexDirection: "column",
                  alignItems: "flex-start",
                }),
          }}
        >
          {tabs.map((t) => (
            <Onglet
              key={t.key}
              t={t}
              active={view === t.key}
              phone={phone}
              onClick={() => setView(t.key)}
            />
          ))}
        </div>

        {/* LES ACTIONS — toujours au pied du rail, toujours visibles.
            Au telephone, « au pied » veut dire au bout : elles se rangent
            a droite de la barre, hors du balayage des onglets, pour que
            le pouce ne les perde pas en faisant defiler la liste. */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            ...(phone
              ? { flexDirection: "row", alignItems: "center", gap: 2 }
              : {
                  paddingTop: 16,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                }),
          }}
        >
          <button
            onClick={onAdd}
            data-tour="add-film"
            title="Épingler un nouveau film"
            style={{
              all: "unset",
              cursor: "pointer",
              /* LES QUATRE ACTIONS DESCENDENT EN TAILLE SUR LE RAIL —
                 trente-quatre, trente, vingt-six, vingt-six — et cette
                 degression dit leur ordre d'importance. Sous un doigt
                 elle ne dit plus rien du tout : elle rend simplement les
                 deux dernieres difficiles a viser. Quarante partout,
                 donc, en dessous de quoi une cible se rate. */
              marginLeft: phone ? 0 : 4,
              width: phone ? 40 : 34,
              height: phone ? 40 : 34,
              borderRadius: "50%",
              background: `radial-gradient(circle at 32% 26%, #fff8, ${C.burgundy} 62%)`,
              color: C.card,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "2px 4px 7px rgba(0,0,0,0.4)",
              transition: "transform .18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.12) rotate(-12deg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            <Pin size={16} />
          </button>

          {/* CHERCHER PARTOUT.

            Juste sous l'épingle, et non dans une vue : la question ne
            s'adresse à aucune d'elles en particulier. Chaque onglet a
            bien son champ, mais aucun ne cherchait au-delà de ce qu'il
            montre — il fallait donc savoir d'avance dans quel onglet se
            trouvait ce qu'on cherchait, ce qui suppose de l'avoir déjà
            trouvé. */}
          <button
            onClick={onSearch}
            data-tour="search-all"
            title="Chercher partout (Ctrl+K)"
            aria-label="Chercher partout"
            style={{
              all: "unset",
              cursor: "pointer",
              marginLeft: phone ? 0 : 6,
              width: phone ? 40 : 30,
              height: phone ? 40 : 30,
              borderRadius: "50%",
              color: C.card,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.ink,
              boxShadow: "2px 3px 6px rgba(0,0,0,0.32)",
              transition: "transform var(--motion-fast) ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            <Search size={14} />
          </button>

          {/* LA PEAU DU SITE, au pied de la tranche du classeur. */}
          <ActionRonde
            onClick={onSkin}
            tour="skin"
            label="Changer la peau du site"
            icon={Palette}
            doigt={phone}
          />

          {/* LA CLÉ TMDB, entre la peau et le compte.

            Elle commande huit écrans — les Découvertes, le sillage, les
            affiches, les fiches d'équipe — et ne se posait que dans
            l'onglet Import, au milieu d'un écran qui parle d'autre
            chose. Un réglage qui commande tout n'appartient à aucune
            vue : il est ici, avec les autres réglages de tout. */}
          <ActionRonde
            onClick={onKey}
            tour="tmdb-key"
            label="La clé TMDB"
            icon={KeyRound}
            doigt={phone}
          />

          {/* LE COMPTE ET SA PASTILLE.

            Elle ne paraît que si un serveur est réglé : un bouton qui
            ouvre un tiroir vide est pire qu'un bouton absent. La
            pastille dit d'un coup d'œil ce qui attend — c'est la seule
            chose qu'on veut savoir sans ouvrir. */}
          {synchro !== "absent" && (
            <ActionRonde
              onClick={onCompte}
              tour="compte"
              label="Votre compte et la synchronisation"
              icon={UserRound}
              doigt={phone}
              marque={
                synchro === "erreur" ? C.burgundy : synchro === "en-attente" ? C.inkFaded : null
              }
            />
          )}

          {/* LA VISITE, au dernier cran du rail.

            Une seule ancre, et toujours la même : c'est ce que la fiche
            de rappel désigne quand on écarte la visite, et ce qu'on
            cherche six mois plus tard en se demandant à quoi servait
            l'étagère. Au dernier cran parce qu'on la consulte encore
            moins souvent — mais jamais ailleurs, jamais rangée dans une
            vue : l'aide d'un outil ne se cache pas dans l'outil. */}
          <ActionRonde
            onClick={onHelp}
            tour="help"
            label="La visite guidée"
            icon={HelpCircle}
            doigt={phone}
          />
        </div>
      </div>
    </div>
  );
}
