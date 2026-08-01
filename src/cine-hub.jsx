import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import {
  Pin, Paperclip, Plus, X, Trash2, ArrowLeft, Upload,
  Star, BookOpen, Palette, Clapperboard, Sparkles, Link2,
} from "lucide-react";
import Papa from "papaparse";

/* ============================================================
   TOKENS — carnet d'archiviste : papier kraft, encre, fil rouge
   ============================================================ */
const C = {
  paper: "#EEE3CC",
  paperDark: "#E2D3AE",
  card: "#F6EFDE",
  ink: "#2B2620",
  inkFaded: "#6E6153",
  burgundy: "#8C3A34",
  ochre: "#B9862E",
  pine: "#3E5B4B",
  slate: "#5C6B78",
  line: "#C9B98F",
  // accents — des touches plus vives qui percent le kraft
  cobalt: "#3A5C8C",
  vermillion: "#C4562E",
  moss: "#6E7A3A",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;1,400&family=Caveat:wght@500;600;700&family=Special+Elite&display=swap');

::selection { background: ${C.ochre}66; color: ${C.ink}; }

body { background: ${C.paper}; }

/* la molette fait défiler un dossier, pas une page web */
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-track { background: ${C.paperDark}; }
::-webkit-scrollbar-thumb { background: ${C.line}; border: 2px solid ${C.paperDark}; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: ${C.inkFaded}; }

@keyframes swayIn { from { opacity: 0; transform: translateY(10px) rotate(var(--tilt, 0deg)); } to { opacity: 1; transform: translateY(0) rotate(var(--tilt, 0deg)); } }

input::placeholder, textarea::placeholder { color: ${C.inkFaded}88; font-style: italic; }
`;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// persistance locale (remplace window.storage du runtime artefact)
const store = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error(e); } },
};

const hash = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return h;
};
const seededRand = (seed) => {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};
const tiltOf = (id) => ((Math.abs(hash(id)) % 90) / 10 - 4.5).toFixed(1);
const TAPE_COLORS = [C.ochre, C.slate, C.burgundy];
const tapeColor = (id) => TAPE_COLORS[Math.abs(hash(id)) % TAPE_COLORS.length];
const hueOf = (id) => {
  // émulsions virées : sépia, cyanotype, sélénium, cibachrome fané…
  const hues = ["#7a5230", "#6b4a4a", "#3f5a52", "#54506b", "#7a5b3a", "#2f4a68", "#6d4a2f", "#4a5c38", "#7b4a52"];
  return hues[Math.abs(hash(id)) % hues.length];
};
const usesPin = (id) => Math.abs(hash(id)) % 2 === 0;
// décalage vertical pour casser l'alignement des colonnes du mur
const nudgeOf = (id) => Math.round(seededRand(Math.abs(hash(id)) + 3) * 34);
// numéro de fiche façon tampon d'archive
const fileNoOf = (id) => String(Math.abs(hash(id)) % 9000 + 1000);

// bord déchiré déterministe (clip-path) pour le bas d'une photo
const tornClip = (id, points = 9) => {
  const base = Math.abs(hash(id));
  const pts = ["0% 0%", "100% 0%", "100% 85%"];
  for (let i = points; i >= 0; i--) {
    const x = (i / points) * 100;
    const y = 85 + seededRand(base + i * 7) * 13;
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  pts.push("0% 85%");
  return `polygon(${pts.join(",")})`;
};

const LINK_TYPES = [
  { key: "book", label: "Livre", icon: BookOpen },
  { key: "painting", label: "Peinture", icon: Palette },
  { key: "film", label: "Film", icon: Clapperboard },
  { key: "other", label: "Autre œuvre", icon: Sparkles },
];

/* ============================================================
   ATMOSPHÈRE — grain, taches, texture
   ============================================================ */
function PaperGrain() {
  return (
    <>
      {/* fibres du papier — de longues stries irrégulières */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.5, mixBlendMode: "multiply",
        backgroundImage: `repeating-linear-gradient(94deg, ${C.line}22 0 1px, transparent 1px 5px), repeating-linear-gradient(3deg, ${C.line}18 0 1px, transparent 1px 9px)`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: GRAIN, mixBlendMode: "multiply", opacity: 0.7, zIndex: 1 }} />
      {/* vignettage — les bords d'une page qu'on a trop manipulée */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, mixBlendMode: "multiply",
        background: `radial-gradient(ellipse at 50% 42%, transparent 42%, ${C.paperDark}bb 88%, #b9a67e88 100%)`,
      }} />
    </>
  );
}

function CoffeeRing({ style, rotate = 0 }) {
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" style={{ position: "absolute", opacity: 0.4, pointerEvents: "none", transform: `rotate(${rotate}deg)`, mixBlendMode: "multiply", ...style }}>
      {/* anneau irrégulier : le café ne sèche jamais en cercle parfait */}
      <path d="M75 14 C 108 14 137 40 138 74 C 139 110 110 138 75 137 C 40 136 12 108 13 73 C 14 39 42 14 75 14 Z"
        fill="none" stroke={C.ochre} strokeWidth="3.2" opacity="0.55" strokeLinecap="round" strokeDasharray="140 9 60 4" />
      <circle cx="75" cy="75" r="52" fill="none" stroke={C.ochre} strokeWidth="1.1" opacity="0.3" />
      <circle cx="75" cy="75" r="58" fill={C.ochre} opacity="0.07" />
    </svg>
  );
}

/* résidu de scotch arraché — un rectangle plus clair et brillant sur le fond */
function TapeResidue({ style, rotate = -18, w = 90 }) {
  return (
    <div style={{
      position: "absolute", width: w, height: 26, pointerEvents: "none", opacity: 0.5,
      transform: `rotate(${rotate}deg)`, background: `linear-gradient(${C.card}88, ${C.paperDark}55)`,
      clipPath: "polygon(4% 0,96% 6%,100% 96%,2% 100%)", ...style,
    }} />
  );
}

/* soulignement tracé à main levée sous un titre */
function InkUnderline({ width = 260, color = C.burgundy, style }) {
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} style={{ display: "block", marginTop: -2, overflow: "visible", ...style }}>
      <path d={`M2 9 C ${width * 0.22} 3, ${width * 0.4} 12, ${width * 0.62} 6 S ${width * 0.88} 4, ${width - 3} 8`}
        fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
      <path d={`M${width * 0.1} 12.5 C ${width * 0.4} 9, ${width * 0.6} 14, ${width * 0.86} 11`}
        fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

/* numéro d'inventaire tamponné dans un coin */
function FileNumber({ id, style }) {
  return (
    <div style={{
      position: "absolute", fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1.2,
      color: C.inkFaded, opacity: 0.55, transform: "rotate(-1.5deg)", pointerEvents: "none", ...style,
    }}>
      N° {fileNoOf(id)}
    </div>
  );
}

function Tape({ color, rotate = -4, width = 70, style }) {
  return (
    <div
      style={{
        position: "absolute", width, height: 22, background: color, opacity: 0.75,
        transform: `rotate(${rotate}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 7px)",
        clipPath: "polygon(2% 0,98% 0,100% 40%,97% 100%,3% 100%,0 60%)",
        ...style,
      }}
    />
  );
}

function PushPin({ color = C.burgundy, style }) {
  return (
    <div
      style={{
        position: "absolute", width: 15, height: 15, borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, #fff9, ${color} 65%)`,
        boxShadow: "0 3px 4px rgba(0,0,0,0.45)", zIndex: 3, ...style,
      }}
    />
  );
}

function StampCorner({ text }) {
  return (
    <div
      style={{
        position: "absolute", top: 22, right: 34, color: C.burgundy,
        border: `2.5px solid ${C.burgundy}`, boxShadow: `inset 0 0 0 1px ${C.paper}, inset 0 0 0 3px ${C.burgundy}88`,
        padding: "7px 13px", fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1.8,
        transform: "rotate(-7deg)", opacity: 0.62, pointerEvents: "none", borderRadius: 2,
        mixBlendMode: "multiply", zIndex: 3,
      }}
    >
      {text}
    </div>
  );
}

function InkStars({ value = 0, onChange, size = 15 }) {
  const editable = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <span key={n} onClick={editable ? () => onChange(n === value ? n - 0.5 : n) : undefined} style={{ cursor: editable ? "pointer" : "default", position: "relative", lineHeight: 0 }}>
            <Star size={size} color={C.burgundy} fill={filled ? C.burgundy : "none"} strokeWidth={1.4} />
            {half && <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}><Star size={size} color={C.burgundy} fill={C.burgundy} strokeWidth={1.4} /></span>}
          </span>
        );
      })}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.inkFaded, marginBottom: 5 }}>{children}</div>;
}

const underlineInput = {
  width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
  padding: "4px 2px", color: C.ink, fontFamily: "'Lora', serif", fontSize: 15, outline: "none", boxSizing: "border-box",
};

const ruledTextarea = {
  width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
  padding: "6px 2px", color: C.ink, fontFamily: "'Caveat', cursive", fontSize: 20, lineHeight: "30px",
  outline: "none", resize: "vertical", boxSizing: "border-box",
  backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${C.line}55 30px)`,
};

/* ============================================================
   POLAROID / FICHE FILM
   ============================================================ */
function FilmPolaroid({ film, onClick }) {
  const tilt = tiltOf(film.id);
  const tape = tapeColor(film.id);
  const hue = hueOf(film.id);
  const pinned = usesPin(film.id);
  const initials = film.title.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const nudge = nudgeOf(film.id);
  // l'ombre tombe du côté opposé à l'inclinaison — la photo n'est pas plaquée à plat
  const rest = `${tilt > 0 ? -3 : 3}px 7px 15px rgba(30,20,10,0.3), 0 1px 2px rgba(30,20,10,0.4)`;
  const lift = `${tilt > 0 ? -6 : 6}px 18px 30px rgba(30,20,10,0.38), 0 2px 3px rgba(30,20,10,0.3)`;

  return (
    <div style={{ breakInside: "avoid", marginBottom: 34, paddingTop: nudge }}>
      <button
        onClick={onClick}
        style={{
          all: "unset", cursor: "pointer", width: "100%", padding: "12px 12px 18px", position: "relative",
          background: `linear-gradient(158deg, #FBF6E9, ${C.card} 55%, ${C.paperDark})`,
          boxShadow: rest, transform: `rotate(${tilt}deg)`, display: "block",
          transition: "transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .25s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translateY(-7px) scale(1.035)"; e.currentTarget.style.boxShadow = lift; e.currentTarget.style.zIndex = 5; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${tilt}deg)`; e.currentTarget.style.boxShadow = rest; e.currentTarget.style.zIndex = "auto"; }}
      >
        {pinned ? (
          <PushPin color={[C.burgundy, C.cobalt, C.moss][Math.abs(hash(film.id)) % 3]} style={{ top: -7, left: "50%", marginLeft: -7 }} />
        ) : (
          <Tape color={tape} rotate={tilt > 0 ? -8 : 8} style={{ top: -10, left: "50%", marginLeft: -35 }} />
        )}
        {/* l'émulsion : dégradé + halo lumineux + grain argentique */}
        <div style={{ position: "relative", height: 150, clipPath: tornClip(film.id), overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${hue}, ${hue}dd 60%, #1c1712)` }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 22%, rgba(255,240,210,0.28), transparent 62%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.5, mixBlendMode: "overlay" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 40, color: "#f3ead8cc", textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>{initials}</span>
          </div>
        </div>
        <div style={{ paddingTop: 14, textAlign: "left" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: C.ink, lineHeight: 1.15 }}>{film.title}</div>
          {/* la légende manuscrite, écrite au dos puis recopiée devant */}
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 2, transform: "rotate(-0.8deg)" }}>
            {film.year || "s.d."} · {film.director || "anonyme"}
          </div>
          <div style={{ marginTop: 8 }}><InkStars value={film.rating || 0} size={12} /></div>
        </div>
        <FileNumber id={film.id} style={{ bottom: 6, right: 10 }} />
        {/* coin corné : un pli d'ombre en bas à droite */}
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, background: `linear-gradient(135deg, transparent 50%, ${C.paperDark} 50%, #cbb894 100%)`, boxShadow: "-1px -1px 2px rgba(30,20,10,0.18)" }} />
      </button>
    </div>
  );
}

/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
function FolderTabs({ view, setView, onAdd }) {
  const tabs = [
    { key: "library", label: "Vidéothèque", color: C.burgundy },
    { key: "notebook", label: "Carnet", color: C.pine },
    { key: "import", label: "Import Letterboxd", color: C.slate },
  ];
  return (
    <div style={{ width: 46, flexShrink: 0, position: "relative", zIndex: 2 }}>
      {/* la tranche du classeur, contre laquelle les onglets butent */}
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 5, background: `linear-gradient(90deg, #b9a67e, ${C.paperDark})`, boxShadow: "inset -2px 0 4px rgba(30,20,10,0.2)", zIndex: 0 }} />
      <div style={{ position: "sticky", top: 0, paddingTop: 30, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        {tabs.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                all: "unset", cursor: "pointer", writingMode: "vertical-rl", transform: "rotate(180deg)",
                // carton teinté dans la masse, pas un aplat : reflet en haut, tranche sombre en bas
                background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${t.color}cc)`,
                filter: active ? "none" : "saturate(0.65) brightness(0.92)",
                color: C.card, fontFamily: "'Special Elite', monospace",
                fontSize: 11.5, letterSpacing: 1.5, padding: "18px 9px", borderRadius: "0 3px 3px 0",
                boxShadow: active
                  ? `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
                  : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
                marginLeft: active ? 0 : -6, transition: "margin .18s cubic-bezier(.2,.8,.3,1), filter .18s ease",
                textShadow: "0 1px 1px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.marginLeft = "0px"; e.currentTarget.style.filter = "none"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.marginLeft = "-6px"; e.currentTarget.style.filter = "saturate(0.65) brightness(0.92)"; } }}
            >
              {t.label}
            </button>
          );
        })}
        <button onClick={onAdd} title="Épingler un nouveau film" style={{ all: "unset", cursor: "pointer", marginTop: 24, marginLeft: 4, width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 32% 26%, #fff8, ${C.burgundy} 62%)`, color: C.card, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 4px 7px rgba(0,0,0,0.4)", transition: "transform .18s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12) rotate(-12deg)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
        >
          <Pin size={16} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FORMULAIRE — NOUVEAU FILM
   ============================================================ */
function FilmModal({ onClose, onSave }) {
  const [f, setF] = useState({ id: uid(), title: "", year: "", director: "", genres: [], themes: [], rating: 0, review: "", notes: "", linkedWorks: [], addedAt: Date.now() });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,10,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, width: "min(520px,100%)", maxHeight: "88vh", overflowY: "auto", padding: "30px 34px", position: "relative", boxShadow: "6px 10px 30px rgba(0,0,0,0.4)" }}>
        <button onClick={onClose} style={{ all: "unset", position: "absolute", top: 18, right: 20, cursor: "pointer", color: C.inkFaded }}><X size={18} /></button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 28, color: C.ink }}>Nouvelle fiche</div>
        <div style={{ height: 1, background: C.line, margin: "14px 0 20px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 2 }}><Label>Titre</Label><input style={underlineInput} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Le titre du film" /></div>
          <div style={{ flex: 1 }}><Label>Année</Label><input style={underlineInput} value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="1975" /></div>
        </div>
        <div style={{ marginTop: 16 }}><Label>Réalisateur·rice</Label><input style={underlineInput} value={f.director} onChange={(e) => set("director", e.target.value)} placeholder="Nom" /></div>
        <div style={{ marginTop: 16 }}><Label>Genres (virgules)</Label><input style={underlineInput} value={f.genres.join(", ")} onChange={(e) => set("genres", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Drame, Science-fiction" /></div>
        <div style={{ marginTop: 16 }}><Label>Thèmes (virgules)</Label><input style={underlineInput} value={f.themes.join(", ")} onChange={(e) => set("themes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Mémoire, Solitude" /></div>
        <div style={{ marginTop: 16 }}><Label>Votre note</Label><InkStars value={f.rating} onChange={(v) => set("rating", v)} size={22} /></div>
        <div style={{ marginTop: 16 }}><Label>Première impression</Label><textarea style={{ ...ruledTextarea, minHeight: 70 }} value={f.review} onChange={(e) => set("review", e.target.value)} placeholder="Ce que ce film vous a fait ressentir…" /></div>
        <button onClick={() => f.title.trim() && onSave(f)} disabled={!f.title.trim()} style={{ all: "unset", marginTop: 24, width: "100%", textAlign: "center", padding: "12px 0", background: f.title.trim() ? C.burgundy : C.line, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 13, letterSpacing: 1, cursor: f.title.trim() ? "pointer" : "not-allowed", boxSizing: "border-box" }}>
          ÉPINGLER CETTE FICHE AU MUR
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   VUE — VIDÉOTHÈQUE (mur en désordre organique)
   ============================================================ */
function LibraryView({ films, onOpen }) {
  const [q, setQ] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [sortBy, setSortBy] = useState("added");

  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);

  const filtered = useMemo(() => {
    let list = films.filter((f) => {
      const mq = !q || f.title.toLowerCase().includes(q.toLowerCase()) || (f.director || "").toLowerCase().includes(q.toLowerCase());
      const mg = !genreFilter || (f.genres || []).includes(genreFilter);
      return mq && mg;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "year") return (b.year || 0) - (a.year || 0);
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  }, [films, q, genreFilter, sortBy]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
      <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
      <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
      <TapeResidue style={{ top: 96, right: 260 }} />
      <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
      <StampCorner text={`CATALOGUE · ${films.length}`} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>Votre vidéothèque</div>
      <InkUnderline width={330} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>un mur d'affiches, de notes et de souvenirs de séances</div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginTop: 26, marginBottom: 34, borderBottom: `1px dashed ${C.line}`, paddingBottom: 18, position: "relative", zIndex: 2 }}>
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input style={underlineInput} placeholder="un titre, un·e cinéaste…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
              const ink = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][Math.abs(hash(g)) % 5];
              const on = genreFilter === g;
              return (
                <button key={g} onClick={() => setGenreFilter(on ? "" : g)} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, padding: "4px 11px", borderRadius: 14, border: `1px solid ${ink}`, color: on ? C.card : ink, background: on ? ink : "transparent", transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`, boxShadow: on ? `1px 2px 4px ${ink}55` : "none", transition: "background .15s ease" }}>{g}</button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Trier</Label>
          <div style={{ display: "flex", gap: 14, fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
            {[["added", "récents"], ["title", "A–Z"], ["year", "année"], ["rating", "note"]].map(([k, l]) => (
              <span key={k} onClick={() => setSortBy(k)} style={{ cursor: "pointer", color: sortBy === k ? C.burgundy : C.inkFaded, textDecoration: sortBy === k ? "underline" : "none" }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>{films.length === 0 ? "Le mur est encore vide" : "Rien à afficher"}</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>{films.length === 0 ? "Épinglez votre premier film pour commencer la collection." : "Essayez une autre recherche."}</div>
        </div>
      ) : (
        <div style={{ columns: "210px", columnGap: 34, position: "relative", zIndex: 2 }}>
          {filtered.map((f) => <FilmPolaroid key={f.id} film={f} onClick={() => onOpen(f.id)} />)}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
function ThreadBoard({ film, onRemove }) {
  const boardRef = useRef(null);
  const pinRef = useRef(null);
  const cardRefs = useRef({});
  const [paths, setPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const works = film.linkedWorks || [];

  const recompute = useCallback(() => {
    const board = boardRef.current;
    const pin = pinRef.current;
    if (!board || !pin) return;
    const bRect = board.getBoundingClientRect();
    const pRect = pin.getBoundingClientRect();
    const x0 = pRect.left + pRect.width / 2 - bRect.left;
    const y0 = pRect.bottom - bRect.top - 2;
    const next = works.map((w) => {
      const el = cardRefs.current[w.id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x1 = r.left + r.width / 2 - bRect.left;
      const y1 = r.top - bRect.top + 4;
      // caténaire : le fil pend d'autant plus qu'il est long, et jamais symétriquement
      const span = Math.abs(x1 - x0);
      const sag = 26 + span * 0.16 + seededRand(Math.abs(hash(w.id))) * 22;
      const c1x = x0 + (x1 - x0) * 0.28, c2x = x0 + (x1 - x0) * 0.72;
      const lowest = Math.max(y0, y1) + sag;
      return {
        id: w.id,
        d: `M ${x0} ${y0} C ${c1x} ${lowest}, ${c2x} ${lowest * 0.96}, ${x1} ${y1}`,
        knot: { x: x1, y: y1 },
      };
    }).filter(Boolean);
    setPaths(next);
    setSvgSize({ w: bRect.width, h: bRect.height });
  }, [works]);

  useLayoutEffect(() => {
    const t = setTimeout(recompute, 30);
    window.addEventListener("resize", recompute);
    return () => { clearTimeout(t); window.removeEventListener("resize", recompute); };
  }, [recompute]);

  return (
    <div ref={boardRef} style={{ position: "relative", paddingTop: 30 }}>
      <svg width={svgSize.w} height={svgSize.h} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
        {paths.map((p) => (
          <g key={p.id}>
            {/* l'ombre du fil, décalée : il flotte au-dessus du papier */}
            <path d={p.d} fill="none" stroke="#2B262033" strokeWidth="3" strokeLinecap="round" transform="translate(1.5,3)" />
            {/* l'âme sombre de la corde, puis la torsade éclairée par-dessus */}
            <path d={p.d} fill="none" stroke="#6B241F" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
            <path d={p.d} fill="none" stroke="#C4562E" strokeWidth="2.6" strokeDasharray="2.5 4" strokeLinecap="round" opacity="0.8" />
            {/* le nœud là où le fil mord la fiche */}
            <circle cx={p.knot.x} cy={p.knot.y} r="3.2" fill="#6B241F" opacity="0.9" />
          </g>
        ))}
      </svg>

      <div ref={pinRef} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.ink, color: C.card, padding: "7px 16px", position: "relative", zIndex: 2 }}>
        <PushPin color={C.burgundy} style={{ position: "static", marginRight: 2 }} />
        <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1 }}>{film.title.toUpperCase()}</span>
      </div>

      {works.length === 0 ? (
        <div style={{ color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 19, marginTop: 26 }}>rien d'épinglé pour l'instant…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 28px", marginTop: 40, position: "relative", zIndex: 2 }}>
          {works.map((w) => {
            const type = LINK_TYPES.find((t) => t.key === w.type) || LINK_TYPES[3];
            const Icon = type.icon;
            const tilt = tiltOf(w.id);
            const pinned = usesPin(w.id);
            return (
              <div
                key={w.id}
                ref={(el) => { if (el) cardRefs.current[w.id] = el; }}
                style={{ position: "relative", background: C.card, padding: "12px 16px 14px", boxShadow: "2px 5px 12px rgba(30,20,10,0.25)", transform: `rotate(${tilt / 2}deg)`, width: 200 }}
              >
                {pinned ? <PushPin style={{ top: -7, left: "50%", marginLeft: -7 }} /> : <Tape color={tapeColor(w.id)} rotate={tilt > 0 ? -8 : 8} width={54} style={{ top: -9, left: "50%", marginLeft: -27 }} />}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon size={15} color={C.burgundy} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.ink, lineHeight: 1.2 }}>{w.title}</div>
                    <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 3 }}>{type.label}{w.creator ? ` — ${w.creator}` : ""}</div>
                    {w.note && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 5 }}>« {w.note} »</div>}
                  </div>
                  <button onClick={() => onRemove(w.id)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
function DetailView({ film, onBack, onUpdate, onDelete }) {
  const [linkType, setLinkType] = useState("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const hue = hueOf(film.id);

  const addLink = () => {
    if (!linkTitle.trim()) return;
    const work = { id: uid(), type: linkType, title: linkTitle.trim(), creator: linkCreator.trim(), note: linkNote.trim() };
    onUpdate({ ...film, linkedWorks: [...(film.linkedWorks || []), work] });
    setLinkTitle(""); setLinkCreator(""); setLinkNote("");
  };
  const removeLink = (id) => onUpdate({ ...film, linkedWorks: (film.linkedWorks || []).filter((w) => w.id !== id) });

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 900, position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button onClick={onBack} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 11.5, marginBottom: 22 }}>
        <ArrowLeft size={14} /> RETOUR AU MUR
      </button>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: C.card, padding: "12px 12px 16px", boxShadow: "3px 6px 14px rgba(30,20,10,0.28)", position: "relative" }}>
            <Tape color={C.burgundy} rotate={-5} style={{ top: -10, left: "50%", marginLeft: -35 }} />
            <div style={{ height: 200, background: `linear-gradient(160deg, ${hue}, ${hue}dd 60%, #1c1712)`, display: "flex", alignItems: "center", justifyContent: "center", clipPath: tornClip(film.id, 11) }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 50, color: "#f3ead8cc" }}>{film.title.slice(0, 2).toUpperCase()}</span>
            </div>
          </div>
          <div style={{ marginTop: 16, border: `1px solid ${C.line}`, padding: "12px 14px", background: C.paperDark }}>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>FICHE CATALOGUE</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 20, color: C.ink, marginTop: 4 }}>{film.title}</div>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, marginTop: 3 }}>{film.year || "s.d."} — {film.director || "anonyme"}</div>
            <div style={{ marginTop: 10 }}><InkStars value={film.rating || 0} onChange={(v) => onUpdate({ ...film, rating: v })} size={18} /></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {(film.genres || []).map((g) => <span key={g} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.burgundy}`, color: C.burgundy, borderRadius: 12, padding: "2px 8px" }}>{g}</span>)}
              {(film.themes || []).map((t) => <span key={t} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.pine}`, color: C.pine, borderRadius: 12, padding: "2px 8px" }}>{t}</span>)}
            </div>
            <button onClick={() => onDelete(film.id)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10, marginTop: 16 }}>
              <Trash2 size={12} /> retirer du mur
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 300, position: "relative" }}>
          <Paperclip size={26} color={C.inkFaded} style={{ position: "absolute", top: -14, left: -22, transform: "rotate(-25deg)", opacity: 0.7 }} />
          <Label>Critique personnelle</Label>
          <textarea style={{ ...ruledTextarea, minHeight: 120 }} value={film.review || ""} onChange={(e) => onUpdate({ ...film, review: e.target.value })} placeholder="Écrivez ici, à main levée…" />
          <div style={{ marginTop: 22 }}>
            <Label>Notes libres</Label>
            <textarea style={{ ...ruledTextarea, minHeight: 70 }} value={film.notes || ""} onChange={(e) => onUpdate({ ...film, notes: e.target.value })} placeholder="Scènes, citations, fragments…" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link2 size={15} color={C.burgundy} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 24, color: C.ink }}>Le fil rouge</div>
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginTop: -2, marginBottom: 8 }}>
          les œuvres qui répondent à ce film — livres, peintures, autres films
        </div>

        <ThreadBoard film={film} onRemove={removeLink} />

        <div style={{ marginTop: 30, border: `1px dashed ${C.line}`, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Label>Type</Label>
            <select value={linkType} onChange={(e) => setLinkType(e.target.value)} style={{ ...underlineInput, fontFamily: "'Special Elite', monospace", fontSize: 12, width: 120 }}>
              {LINK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}><Label>Titre de l'œuvre</Label><input style={underlineInput} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Titre" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><Label>Auteur·rice / artiste</Label><input style={underlineInput} value={linkCreator} onChange={(e) => setLinkCreator(e.target.value)} placeholder="Nom" /></div>
          <div style={{ flex: 1.4, minWidth: 180 }}><Label>Pourquoi ce lien ?</Label><input style={underlineInput} value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="La résonance entre les deux" /></div>
          <button onClick={addLink} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> relier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VUE — CARNET
   ============================================================ */
function NotebookView({ notes, onAdd, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = () => {
    if (!body.trim() && !title.trim()) return;
    onAdd({ id: uid(), title: title.trim() || "Sans titre", body, createdAt: Date.now() });
    setTitle(""); setBody("");
  };
  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 720, position: "relative" }}>
      <StampCorner text="CARNET" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Le carnet</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 26 }}>des pensées libres, qui n'appartiennent à aucun film en particulier</div>

      <div style={{ background: C.card, padding: 20, boxShadow: "3px 5px 12px rgba(30,20,10,0.22)", transform: "rotate(-0.6deg)" }}>
        <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 19, fontWeight: 700 }} placeholder="Titre de la note" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...ruledTextarea, minHeight: 90, marginTop: 8 }} placeholder="Écrivez librement…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={create} style={{ all: "unset", cursor: "pointer", marginTop: 14, background: C.pine, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11 }}>+ AJOUTER LA PAGE</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
        {notes.length === 0 && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, color: C.inkFaded }}>le carnet attend sa première page…</div>}
        {[...notes].sort((a, b) => b.createdAt - a.createdAt).map((n) => (
          <div key={n.id} style={{ background: C.card, padding: 18, boxShadow: "2px 4px 10px rgba(30,20,10,0.2)", transform: `rotate(${tiltOf(n.id) / 3}deg)`, position: "relative" }}>
            <button onClick={() => onDelete(n.id)} style={{ all: "unset", position: "absolute", top: 12, right: 14, cursor: "pointer", color: C.inkFaded }}><Trash2 size={13} /></button>
            <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 18, border: "none" }} value={n.title} onChange={(e) => onUpdate({ ...n, title: e.target.value })} />
            <textarea style={{ ...ruledTextarea, minHeight: 50, border: "none" }} value={n.body} onChange={(e) => onUpdate({ ...n, body: e.target.value })} />
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 6 }}>{new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   VUE — IMPORT LETTERBOXD
   ============================================================ */
function ImportView({ onImport, existingCount }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    setFileName(file.name); setStatus("");
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const mapped = res.data.map((r) => ({ title: r.Name || r.name || r.Title || "", year: r.Year || r.year || "", rating: r.Rating ? Number(r.Rating) : 0 })).filter((r) => r.title);
        setRows(mapped);
        if (mapped.length === 0) setStatus("Aucune ligne exploitable trouvée dans ce fichier.");
      },
      error: () => setStatus("Impossible de lire ce fichier CSV."),
    });
  };

  const doImport = () => { onImport(rows); setStatus(`${rows.length} film(s) épinglé(s) au mur.`); setRows([]); setFileName(""); };

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 680, position: "relative" }}>
      <StampCorner text="ARCHIVES" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Bordereau d'import</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 26 }}>déposez votre export Letterboxd (diary.csv ou watched.csv)</div>

      <div style={{ border: `2px dashed ${C.line}`, padding: 34, textAlign: "center", background: C.paperDark }}>
        <Upload size={24} color={C.burgundy} style={{ marginBottom: 10 }} />
        <div style={{ color: C.ink, fontFamily: "'Lora', serif", fontSize: 14, marginBottom: 14 }}>Réglages → Importer/Exporter sur Letterboxd, puis déposez le fichier ici.</div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <button onClick={() => fileRef.current.click()} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "9px 18px", fontFamily: "'Special Elite', monospace", fontSize: 11.5 }}>CHOISIR UN FICHIER</button>
        {fileName && <div style={{ color: C.inkFaded, fontSize: 12, marginTop: 10, fontFamily: "'Special Elite', monospace" }}>{fileName}</div>}
      </div>

      {status && <div style={{ marginTop: 16, color: C.pine, fontFamily: "'Caveat', cursive", fontSize: 19 }}>{status}</div>}

      {rows.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <Label>Aperçu ({rows.length} entrée(s))</Label>
          <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${C.line}`, background: C.card }}>
            {rows.slice(0, 50).map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}>
                <span>{r.title} {r.year && <span style={{ color: C.inkFaded }}>({r.year})</span>}</span>
                {r.rating > 0 && <InkStars value={r.rating} size={11} />}
              </div>
            ))}
          </div>
          <button onClick={doImport} style={{ all: "unset", cursor: "pointer", marginTop: 14, background: C.pine, color: C.card, padding: "10px 18px", fontFamily: "'Special Elite', monospace", fontSize: 11.5 }}>ÉPINGLER {rows.length} FILM(S) AU MUR</button>
        </div>
      )}

      <div style={{ marginTop: 26, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded }}>{existingCount} film(s) déjà au catalogue — les doublons (même titre et année) seront ignorés.</div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [films, setFilms] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setFilms(store.get("films", []));
    setNotes(store.get("notebook-notes", []));
    setLoaded(true);
  }, []);

  const saveFilms = (next) => { setFilms(next); store.set("films", next); };
  const saveNotes = (next) => { setNotes(next); store.set("notebook-notes", next); };

  const addFilm = (film) => { saveFilms([film, ...films]); setShowModal(false); };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  const deleteFilm = (id) => { saveFilms(films.filter((f) => f.id !== id)); setView("library"); setSelectedId(null); };

  const importFilms = (rows) => {
    const existingKeys = new Set(films.map((f) => `${f.title.toLowerCase()}-${f.year}`));
    const newOnes = rows.filter((r) => !existingKeys.has(`${r.title.toLowerCase()}-${r.year}`)).map((r) => ({
      id: uid(), title: r.title, year: r.year, director: "", genres: [], themes: [], rating: r.rating || 0, review: "", notes: "", linkedWorks: [], addedAt: Date.now(),
    }));
    saveFilms([...newOnes, ...films]);
  };

  const selectedFilm = films.find((f) => f.id === selectedId);

  if (!loaded) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 22 }}>
        <style>{FONT_IMPORT}</style>
        ouverture du classeur…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", position: "relative",
      // le kraft n'est pas uniforme : des nappes plus claires là où la lumière tombe
      background: `
        radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
        radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
        radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
        ${C.paper}`,
    }}>
      <style>{FONT_IMPORT}</style>
      <PaperGrain />
      <FolderTabs view={view} setView={(v) => { setView(v); setSelectedId(null); }} onAdd={() => setShowModal(true)} />
      <div style={{ flex: 1, position: "relative", zIndex: 2 }}>
        {view === "library" && !selectedId && <LibraryView films={films} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "detail" && selectedFilm && <DetailView film={selectedFilm} onBack={() => { setView("library"); setSelectedId(null); }} onUpdate={updateFilm} onDelete={deleteFilm} />}
        {view === "notebook" && <NotebookView notes={notes} onAdd={(n) => saveNotes([n, ...notes])} onUpdate={(n) => saveNotes(notes.map((x) => (x.id === n.id ? n : x)))} onDelete={(id) => saveNotes(notes.filter((x) => x.id !== id))} />}
        {view === "import" && <ImportView onImport={importFilms} existingCount={films.length} />}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}
    </div>
  );
}
