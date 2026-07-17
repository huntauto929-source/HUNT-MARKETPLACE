import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, MessageCircle, User, LogOut, X, ChevronLeft,
  Wrench, ShieldCheck, Send, Car, Fuel, Clock, AlertTriangle,
  CreditCard, CheckCircle, Lock, Package, Shield, Radio, Flag,
  MapPin, Trash2, Navigation, Star, Pencil, Image as ImageIcon, Bell,
  Heart, MessageSquare, Users, Globe, EyeOff, UserPlus, UserCheck, Camera, Eye, Mail, Video, Film, Share2, Link2,
} from "lucide-react";
import { signUp, signIn, signOut, sendPasswordReset, updatePassword, updateProfile, getSessionUser, onAuthChange, fileReport, getPublicProfile, submitReview, getReviews, getMyReviewedListingIds } from "./authClient.js";
import { uploadListingPhotos, deleteListingPhotos, validatePhotoFiles, MAX_PHOTOS, uploadAvatar, validateVideoFile, uploadFeedVideo, deleteFeedVideo } from "./photos.js";
import {
  getLastRead, setLastRead, notificationsSupported, notificationPermission,
  requestNotificationPermission, maybeNotifyNewMessage,
  getActivityWatermark, setActivityWatermark, showActivityNotification,
} from "./notifications.js";
import {
  sendFriendRequest, respondFriendRequest, removeFriend, getFriendState,
  createPost, deletePost, getFeed, getAvatarsForUsernames,
  toggleLike, getLikeSummary, getComments, addComment, deleteComment, getCommentCounts,
  getActivitySince,
} from "./feed.js";
import { geocodeAddress, reverseGeocode, getCurrentPosition, googleMapsEmbedUrl, googleMapsDirectionsUrl } from "./geo.js";

/* ===========================================================
   HunT — automobile trade marketplace.
   Design system uses INLINE STYLES for every color/exact size.
   This environment's Tailwind has no JIT compiler, so bracket
   classes like bg-[#F5C400] never render — inline style={} is
   the only reliable way to hit exact brand colors here.
   Tailwind utility classes are still used for layout/spacing
   (flex, grid, gap, padding, rounded, core text sizes) since
   those are pre-built into the base stylesheet.
=========================================================== */

/* ===========================================================
   THEME SYSTEM
   C is a single mutable object that every component reads colors
   from at render time (e.g. C.bg, C.accent). Switching themes just
   overwrites C's properties in place (Object.assign) — since nothing
   in this file caches C.xxx at import time, every component picks up
   the new values the next time it renders. applyTheme() + the root
   component's `theme` state are what trigger that re-render.
=========================================================== */

const THEMES = {
  midnight: {
    label: "Midnight", swatch: "#ffe666",
    bg: "#0a0a0a", panel: "#151513", panel2: "#1e1e1a", border: "#2c2c26", borderSoft: "#1f1f1c",
    accent: "#ffe666", accentHover: "#fff2a3", accentDim: "rgba(255,230,102,0.14)", accentLine: "rgba(255,230,102,0.34)",
    gold: "#ffd23f", goldDim: "rgba(255,210,63,0.14)",
    text: "#f6f6f0", muted: "#9a9a90", mutedDim: "#65655c",
    warn: "#ff8a65", warnDim: "rgba(255,138,101,0.14)",
  },
  white: {
    label: "White", swatch: "#3b82f6",
    bg: "#ffffff", panel: "#f5f6f8", panel2: "#eceef2", border: "#dde1e7", borderSoft: "#e7e9ed",
    accent: "#3b82f6", accentHover: "#60a5fa", accentDim: "rgba(59,130,246,0.12)", accentLine: "rgba(59,130,246,0.32)",
    gold: "#2563eb", goldDim: "rgba(37,99,235,0.12)",
    text: "#12151a", muted: "#5b6472", mutedDim: "#8a92a0",
    warn: "#d6472f", warnDim: "rgba(214,71,47,0.12)",
  },
  blue: {
    label: "Blue", swatch: "#5ec8ff",
    bg: "#0a1220", panel: "#12203a", panel2: "#182a48", border: "#25406b", borderSoft: "#1c3255",
    accent: "#5ec8ff", accentHover: "#8ddcff", accentDim: "rgba(94,200,255,0.14)", accentLine: "rgba(94,200,255,0.34)",
    gold: "#5ec8ff", goldDim: "rgba(94,200,255,0.14)",
    text: "#eaf4ff", muted: "#8fa8c4", mutedDim: "#5d7796",
    warn: "#ff9166", warnDim: "rgba(255,145,102,0.14)",
  },
  forest: {
    label: "Forest", swatch: "#7fe0a0",
    bg: "#0a1410", panel: "#132018", panel2: "#1a2b20", border: "#2c4736", borderSoft: "#1f3528",
    accent: "#7fe0a0", accentHover: "#a6ecc0", accentDim: "rgba(127,224,160,0.14)", accentLine: "rgba(127,224,160,0.34)",
    gold: "#7fe0a0", goldDim: "rgba(127,224,160,0.14)",
    text: "#eafff0", muted: "#8fb89e", mutedDim: "#5f8770",
    warn: "#ff8a65", warnDim: "rgba(255,138,101,0.14)",
  },
  sunset: {
    label: "Sunset", swatch: "#ff9d5c",
    bg: "#170e0a", panel: "#241611", panel2: "#301e17", border: "#4a2f22", borderSoft: "#38241b",
    accent: "#ff9d5c", accentHover: "#ffb884", accentDim: "rgba(255,157,92,0.14)", accentLine: "rgba(255,157,92,0.34)",
    gold: "#ff9d5c", goldDim: "rgba(255,157,92,0.14)",
    text: "#fff3ea", muted: "#c8a389", mutedDim: "#8f6c56",
    warn: "#ff5c5c", warnDim: "rgba(255,92,92,0.14)",
  },
};

const THEME_LIST = Object.keys(THEMES).map((id) => ({ id, ...THEMES[id] }));
const DEFAULT_THEME = "midnight";
const THEME_STORAGE_KEY = "hunt:theme";

// The live, mutable palette every component reads from.
const C = { ...THEMES[DEFAULT_THEME] };

function applyTheme(themeId) {
  const palette = THEMES[themeId] || THEMES[DEFAULT_THEME];
  Object.assign(C, palette);
  try { localStorage.setItem(THEME_STORAGE_KEY, themeId); } catch (_) { /* ignore */ }
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved && THEMES[saved] ? saved : DEFAULT_THEME;
  } catch (_) {
    return DEFAULT_THEME;
  }
}

const MONO = "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";

const CATEGORIES = [
  { id: "parts", label: "Spare Parts", icon: Wrench },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "mechanic", label: "Mechanic / Repair", icon: Wrench },
  { id: "detailing", label: "Wash & Detailing", icon: ShieldCheck },
  { id: "towing", label: "Towing", icon: Car },
  { id: "tires", label: "Tires & Wheels", icon: Car },
  { id: "rental", label: "Car Rental", icon: Car },
  { id: "fuel", label: "Fuel / EV Charging", icon: Fuel },
];

const ADMIN_MIN_AGE = 13;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function calcAge(dobStr) {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function chatKey(a, b) {
  return "hunt:chat:" + [a, b].sort().join("__");
}

/* ---------------------------------------------------------- GLOBAL STYLE TAG */
function GlobalFX() {
  return (
    <style>{`
      @keyframes hunt-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes hunt-dive { from { background-position: 0 0; } to { background-position: 0 40px; } }
      .hunt-topline {
        background-color: ${C.borderSoft};
        background-image: linear-gradient(90deg, transparent 0%, ${C.accentLine} 50%, transparent 100%);
      }
      .hunt-grid {
        background-image:
          linear-gradient(${C.borderSoft} 1px, transparent 1px),
          linear-gradient(90deg, ${C.borderSoft} 1px, transparent 1px);
        background-size: 34px 34px;
      }
      .hunt-plane-wrap {
        position: absolute;
        left: 0; right: 0; bottom: 0; height: 62%;
        overflow: hidden;
        pointer-events: none;
      }
      .hunt-plane {
        position: absolute;
        left: -25%; right: -25%; bottom: 0; height: 100%;
        background-image:
          linear-gradient(${C.accentLine} 1px, transparent 1px),
          linear-gradient(90deg, ${C.accentLine} 1px, transparent 1px);
        background-size: 40px 40px;
        transform: perspective(280px) rotateX(64deg);
        transform-origin: bottom;
        animation: hunt-dive 3.5s linear infinite;
        opacity: 0.55;
        mask-image: linear-gradient(to top, black 0%, black 55%, transparent 100%);
        -webkit-mask-image: linear-gradient(to top, black 0%, black 55%, transparent 100%);
      }
      .hunt-horizon {
        position: absolute;
        left: 10%; right: 10%; top: 0; height: 1px;
        background: ${C.accent};
        box-shadow: 0 0 24px 2px ${C.accentLine}, 0 0 60px 8px ${C.accentDim};
        opacity: 0.8;
      }
      .hunt-fadeup { animation: hunt-fade-up .35s ease both; }
      .hunt-scroll::-webkit-scrollbar { display: none; }
      /* Tailwind bracket classes like w-[76px] don't render in this
         environment (no JIT compiler) — this real CSS rule replaces
         them so the sidebar actually gets a width instead of
         collapsing/overlapping the main content next to it. */
      .hunt-sidebar { width: 76px; }
      @media (min-width: 1024px) { .hunt-sidebar { width: 240px; } }
    `}</style>
  );
}

/* ---------------------------------------------------------- PRIMITIVES */
function DivePlane() {
  return (
    <div className="hunt-plane-wrap">
      <div className="hunt-horizon" />
      <div className="hunt-plane" />
    </div>
  );
}

function HazardBar() {
  return <div className="hunt-topline" style={{ height: 3, width: "100%" }} />;
}

function Logo({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 900, letterSpacing: "-0.02em", fontSize: size }}>
      <span style={{ color: C.text }}>Hun</span>
      <span style={{ color: C.accent }}>T</span>
    </div>
  );
}

function Eyebrow({ children, dot = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
      {dot && (
        <span
          className="animate-pulse"
          style={{ width: 6, height: 6, borderRadius: 999, background: C.accent, boxShadow: `0 0 8px ${C.accent}` }}
        />
      )}
      {children}
    </div>
  );
}

function SecureChip() {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: `1px solid ${C.accentLine}`, background: C.accentDim,
        borderRadius: 999, padding: "4px 10px",
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent,
      }}
    >
      <Shield size={11} />
      Secure session
    </div>
  );
}

function MinorChip({ unverified = false }) {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: `1px solid rgba(255,107,74,0.4)`, background: C.warnDim,
        borderRadius: 999, padding: "4px 10px",
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.warn,
      }}
    >
      <ShieldCheck size={11} />
      {unverified ? "Limited access · add birthday" : "Limited access · under 18"}
    </div>
  );
}

function RestrictedChip() {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: `1px solid rgba(255,107,74,0.4)`, background: C.warnDim,
        borderRadius: 999, padding: "4px 10px",
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.warn,
      }}
    >
      <Flag size={11} />
      Restricted after complaints
    </div>
  );
}

function Field({ as = "input", style = {}, ...props }) {
  const [focus, setFocus] = useState(false);
  const Tag = as;
  return (
    <Tag
      {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      style={{
        width: "100%", background: C.panel, color: C.text,
        border: `1px solid ${focus ? C.accent : C.border}`,
        borderRadius: 10, padding: "12px 16px", fontSize: 14,
        outline: "none", transition: "border-color .15s",
        boxShadow: focus ? `0 0 0 3px ${C.accentDim}` : "none",
        ...style,
      }}
    />
  );
}

function PasswordField({ value, onChange, placeholder, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Field
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingRight: 42 }}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)",
          background: "none", border: "none", color: C.mutedDim, cursor: "pointer",
          padding: 4, display: "flex", alignItems: "center",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}


function Btn({ children, variant = "primary", style = {}, disabled, ...props }) {
  const [hover, setHover] = useState(false);
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em",
    borderRadius: 10, padding: "13px 16px", fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    transition: "all .15s", opacity: disabled ? 0.55 : 1,
  };
  const variants = {
    primary: {
      background: hover && !disabled ? C.accentHover : C.accent,
      color: "#0a0a0a",
      boxShadow: hover && !disabled ? `0 0 22px ${C.accentDim}` : "none",
    },
    ghost: {
      background: "transparent",
      color: hover ? C.accent : C.muted,
      border: `1px solid ${hover ? C.accentLine : C.border}`,
    },
    subtle: {
      background: "transparent",
      color: C.muted,
      textTransform: "uppercase",
      fontSize: 11,
      letterSpacing: "0.08em",
      padding: "6px 8px",
    },
  };
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

function ErrorNote({ children }) {
  return (
    <div
      style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        background: C.warnDim, border: `1px solid rgba(255,107,74,0.4)`,
        borderRadius: 10, padding: "10px 12px", fontSize: 12, color: C.warn,
      }}
    >
      <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

/* ---------------------------------------------------------- PHOTO PICKER (used by post + edit listing) */
function PhotoPicker({ photos, setPhotos, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const addFiles = (fileList) => {
    setError("");
    try {
      const valid = validatePhotoFiles(fileList, photos.length);
      const additions = valid.map((f) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        url: URL.createObjectURL(f),
      }));
      setPhotos((p) => [...p, ...additions]);
    } catch (err) {
      setError(err?.message || "Couldn't add that photo.");
    }
  };

  const remove = (id) => setPhotos((p) => p.filter((ph) => ph.id !== id));

  return (
    <div>
      <label style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginLeft: 4 }}>
        Photos ({photos.length}/{MAX_PHOTOS})
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {photos.map((p) => (
          <div key={p.id} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                title="Remove photo"
                style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 999, color: "#fff", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ width: 72, height: 72, borderRadius: 10, border: `1px dashed ${C.border}`, background: "none", color: C.mutedDim, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 3, flexShrink: 0 }}
          >
            <ImageIcon size={16} />
            <span style={{ fontSize: 9, fontWeight: 700 }}>Add</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
      {error && <p style={{ fontSize: 11, color: C.warn, marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 6, lineHeight: 1.5 }}>
        Optional, up to {MAX_PHOTOS}. JPEG, PNG, WEBP, or GIF, under 8MB each.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- VIDEO PICKER (feed posts) */
function VideoPicker({ video, setVideo, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const pick = (file) => {
    setError("");
    if (!file) return;
    try {
      validateVideoFile(file);
      if (video?.url) URL.revokeObjectURL(video.url);
      setVideo({ file, url: URL.createObjectURL(file) });
    } catch (err) {
      setError(err?.message || "Couldn't add that video.");
    }
  };

  const remove = () => {
    if (video?.url) URL.revokeObjectURL(video.url);
    setVideo(null);
  };

  return (
    <div>
      <label style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginLeft: 4 }}>
        Video
      </label>
      <div style={{ marginTop: 6 }}>
        {video ? (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <video src={video.url} controls style={{ width: "100%", maxHeight: 240, display: "block", background: "#000" }} />
            {!disabled && (
              <button
                type="button"
                onClick={remove}
                title="Remove video"
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 999, color: "#fff", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, border: `1px dashed ${C.border}`, background: "none", color: C.mutedDim, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
            >
              <Video size={18} />
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>Add a video</span>
            </button>
          )
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />
      {error && <p style={{ fontSize: 11, color: C.warn, marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 6, lineHeight: 1.5 }}>
        Optional. MP4, WEBM, or MOV, under 50MB.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- STAR RATING */
function StarRating({ value, onChange, size = 18, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          style={{ background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "pointer", lineHeight: 0 }}
        >
          <Star size={size} color={C.accent} fill={n <= display ? C.accent : "transparent"} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- AVATAR */
function Avatar({ name, url, size = 40, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: 999, background: C.accent, color: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
        fontSize: Math.round(size * 0.42), flexShrink: 0, overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        name?.[0]?.toUpperCase() || "?"
      )}
    </div>
  );
}

/* ---------------------------------------------------------- LIKE BUTTON */
function LikeButton({ targetType, targetId, initialCount = 0, initialLiked = false, size = 13 }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLiked(initialLiked); setCount(initialCount); }, [initialLiked, initialCount]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await toggleLike(targetType, targetId);
    } catch (err) {
      console.error("Like failed:", err);
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: liked ? C.warn : C.mutedDim }}
    >
      <Heart size={size} fill={liked ? C.warn : "transparent"} />
      <span style={{ fontSize: size - 1, fontFamily: MONO }}>{count}</span>
    </button>
  );
}

/* ---------------------------------------------------------- SHARE BUTTON */
function buildShareUrl(type, id) {
  return `${window.location.origin}/?${type}=${encodeURIComponent(id)}`;
}

function ShareButton({ url, title, text, size = 13 }) {
  const [copied, setCopied] = useState(false);

  const doShare = async (e) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (_) {
        // person cancelled the native share sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <button
      onClick={doShare}
      title="Share"
      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: copied ? C.accent : C.mutedDim }}
    >
      {copied ? <Link2 size={size} /> : <Share2 size={size} />}
      {copied && <span style={{ fontSize: size - 2, fontFamily: MONO }}>Copied</span>}
    </button>
  );
}

/* ---------------------------------------------------------- COMMENTS MODAL (shared: listings + feed posts) */
function CommentsModal({ targetType, targetId, title, currentUser, onClose, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await getComments(targetType, targetId);
      setComments(c);
      onCountChange?.(c.length);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await addComment(targetType, targetId, text);
      setDraft("");
      await load();
    } catch (err) {
      window.alert(err?.message || "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteComment(id);
      await load();
    } catch (err) {
      window.alert(err?.message || "Couldn't delete that comment.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h2 style={{ fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <MessageSquare size={15} color={C.accent} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Comments"}</span>
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", flexShrink: 0 }}><X size={20} /></button>
        </div>

        <div className="hunt-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {loading ? (
            <p style={{ color: C.mutedDim, fontSize: 13, fontFamily: MONO }}>Loading...</p>
          ) : comments.length === 0 ? (
            <p style={{ color: C.mutedDim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No comments yet — say something.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontFamily: MONO, color: C.mutedDim }}>
                      @{c.authorUsername} <span style={{ marginLeft: 4 }}>{timeAgo(c.createdAt)}</span>
                    </p>
                    <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.4 }}>{c.text}</p>
                  </div>
                  {c.authorUsername === currentUser?.username && (
                    <button onClick={() => remove(c.id)} title="Delete comment" style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", flexShrink: 0, padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.borderSoft}` }}>
          <Field value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment..." style={{ borderRadius: 999 }} />
          <button type="submit" disabled={busy || !draft.trim()} style={{ background: C.accent, border: "none", borderRadius: 999, padding: 10, cursor: "pointer", flexShrink: 0, opacity: busy || !draft.trim() ? 0.5 : 1 }}>
            <Send size={16} color="#0a0a0a" />
          </button>
        </form>
      </div>
    </div>
  );
}


function AuthShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <GlobalFX />
      <DivePlane />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <HazardBar />
        <div
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}
        >
          <div className="hunt-fadeup" style={{ width: "100%", maxWidth: 380 }}>
            {children}
          </div>
        </div>
        <HazardBar />
      </div>
    </div>
  );
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("signup"); // signup | login | forgot | check-email
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const switchMode = (m) => { setMode(m); setError(""); setNotice(""); };

  const tabStyle = (active) => ({
    flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.03em", border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#0a0a0a" : C.muted,
    transition: "all .15s",
  });

  const doSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      setError("Fill in every field to create your ID.");
      return;
    }
    if (!USERNAME_RE.test(form.username.trim())) {
      setError("HunT ID can only use letters, numbers, dots, dashes, or underscores — no spaces.");
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError("That doesn't look like a valid email.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }
    if (!agreed) {
      setError("You need to agree to the Terms and Privacy Notice to create an ID.");
      return;
    }
    setBusy(true);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        name: form.name.trim(),
      });
      setNotice(`We sent a confirmation link to ${form.email.trim()}. Click it, then come back and log in.`);
      setMode("check-email");
    } catch (err) {
      console.error("HunT signup error:", err);
      setError(err?.message || "Couldn't create your ID. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn({ email: form.email.trim(), password: form.password });
      // onAuthChange (set up by the root component) picks up the new
      // session and calls onLogin automatically.
    } catch (err) {
      setError(err?.message || "Couldn't log in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  const doForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) {
      setError("Enter the email your account uses.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(form.email.trim());
      setNotice(`If ${form.email.trim()} has a HunT account, a password reset link is on its way.`);
    } catch (err) {
      setError(err?.message || "Couldn't send the reset email. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "check-email") {
    return (
      <AuthShell>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Logo size={34} />
        </div>
        <div style={{ background: C.accentDim, border: `1px solid ${C.accentLine}`, borderRadius: 10, padding: "16px 18px", fontSize: 13, color: C.accent, lineHeight: 1.6, marginBottom: 16 }}>
          {notice}
        </div>
        <Btn onClick={() => switchMode("login")} style={{ width: "100%" }}>Back to log in</Btn>
      </AuthShell>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthShell>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Logo size={34} />
          <div style={{ marginTop: 10 }}>
            <Eyebrow>Reset your password</Eyebrow>
          </div>
        </div>
        <form onSubmit={doForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Your account email" />
          {notice && (
            <div style={{ background: C.accentDim, border: `1px solid ${C.accentLine}`, borderRadius: 10, padding: "12px 16px", fontSize: 12, color: C.accent, lineHeight: 1.6 }}>
              {notice}
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          <Btn type="submit" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</Btn>
          <Btn type="button" variant="subtle" onClick={() => switchMode("login")}>Back to log in</Btn>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Logo size={38} />
        <p style={{ marginTop: 8, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
          The automobile marketplace
        </p>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <SecureChip />
        </div>
      </div>

      <div style={{ display: "flex", background: C.panel, borderRadius: 10, padding: 4, marginBottom: 20, border: `1px solid ${C.border}` }}>
        {["signup", "login"].map((m) => (
          <button key={m} onClick={() => switchMode(m)} style={tabStyle(mode === m)}>
            {m === "signup" ? "Create ID" : "Log In"}
          </button>
        ))}
      </div>

      <form onSubmit={mode === "signup" ? doSignUp : doLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <>
            <Field value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Full name" />
            <Field value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="Choose a HunT ID (username)" />
          </>
        )}

        <Field type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email" />
        <PasswordField value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Password" />
        {mode === "signup" && (
          <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.mutedDim, marginLeft: 4 }}>
            <Lock size={10} /> At least 8 characters. You'll confirm this email before logging in.
          </p>
        )}
        {mode === "login" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            style={{ alignSelf: "flex-end", background: "none", border: "none", color: C.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
          >
            Forgot password?
          </button>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        {mode === "signup" && (
          <>
            <p style={{ fontSize: 10.5, color: C.mutedDim, lineHeight: 1.6, padding: "0 4px" }}>
              You must be {ADMIN_MIN_AGE} or older to use HunT. We'll ask for your birthday from
              your profile settings — buying and a few other features stay locked until you add it.
            </p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 11.5, color: C.muted, padding: "2px 4px", cursor: "pointer", lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 15, height: 15, accentColor: C.accent, flexShrink: 0 }}
              />
              <span>
                I agree to HunT's Terms of Use and Privacy Notice, and confirm the account details
                I've given are my own.
              </span>
            </label>
          </>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? "Working..." : mode === "signup" ? "Create my ID" : "Log in"}
        </Btn>
      </form>
    </AuthShell>
  );
}

/* ---------------------------------------------------------- SET NEW PASSWORD (from reset email) */
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password needs to be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError(err?.message || "Couldn't update your password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Logo size={34} />
        <div style={{ marginTop: 10 }}>
          <Eyebrow>Set a new password</Eyebrow>
        </div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
        <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" disabled={busy}>{busy ? "Saving..." : "Save new password"}</Btn>
      </form>
    </AuthShell>
  );
}


/* ---------------------------------------------------------- NAV */
function NavShell({ user, screen, setScreen, onLogout, children, isMinor, isRestricted, ageUnverified, unreadTotal = 0, activityCount = 0 }) {
  const items = [
    { id: "home", label: "Market", icon: Search },
    { id: "feed", label: "Feed", icon: Radio },
    { id: "post", label: "Sell", icon: Plus },
    { id: "chat", label: "Chats", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: User },
  ];
  const [navHover, setNavHover] = useState(null);

  const navBtnStyle = (id) => ({
    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10,
    fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
    background: screen === id ? C.accent : navHover === id ? C.panel2 : "transparent",
    color: screen === id ? "#0a0a0a" : C.muted,
    transition: "all .12s",
  });

  const navBadgeFor = (id) => (id === "chat" ? unreadTotal : id === "profile" ? activityCount : 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex" }} className="md:flex-row flex-col">
      <GlobalFX />
      <aside
        className="hidden md:flex hunt-sidebar"
        style={{ flexDirection: "column", borderRight: `1px solid ${C.borderSoft}`, padding: 20, flexShrink: 0 }}
      >
        <div className="lg:block hidden"><Logo /></div>
        <div className="lg:hidden flex justify-center"><Logo size={22} /></div>
        <p className="hidden lg:block" style={{ fontSize: 11, color: C.mutedDim, marginTop: 4, marginBottom: 12 }}>
          Automobile marketplace
        </p>
        <div className="hidden lg:flex" style={{ marginTop: 8 }}>
          {isRestricted ? <RestrictedChip /> : isMinor ? <MinorChip unverified={ageUnverified} /> : <SecureChip />}
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 24 }}>
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setScreen(it.id)}
              onMouseEnter={() => setNavHover(it.id)}
              onMouseLeave={() => setNavHover(null)}
              style={navBtnStyle(it.id)}
              className="lg:justify-start justify-center"
              title={it.label}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <it.icon size={18} />
                {navBadgeFor(it.id) > 0 && (
                  <span
                    style={{
                      position: "absolute", top: -6, right: -8, minWidth: 15, height: 15, padding: "0 3px",
                      borderRadius: 999, background: C.warn, color: "#0a0a0a", fontSize: 9, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO,
                    }}
                  >
                    {navBadgeFor(it.id) > 9 ? "9+" : navBadgeFor(it.id)}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">{it.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${C.borderSoft}` }}>
          <div className="hidden lg:block">
            <p style={{ fontSize: 13, fontWeight: 800 }}>{user.name}</p>
            <p style={{ fontSize: 11, color: C.mutedDim, marginBottom: 10, fontFamily: MONO }}>@{user.username}</p>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="lg:justify-start justify-center"
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: C.muted, cursor: "pointer", width: "100%", padding: 0 }}
          >
            <LogOut size={15} />
            <span className="hidden lg:inline" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Log out
            </span>
          </button>
        </div>
      </aside>

      <header
        className="md:hidden"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}`,
          position: "sticky", top: 0, background: C.bg, zIndex: 20,
        }}
      >
        <Logo size={20} />
        {isRestricted ? <RestrictedChip /> : isMinor ? <MinorChip unverified={ageUnverified} /> : <SecureChip />}
        <button onClick={onLogout} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
          <LogOut size={18} />
        </button>
      </header>

      <main className="hunt-scroll" style={{ flex: 1, paddingBottom: 84, overflowY: "auto" }}>
        {children}
      </main>

      <nav
        className="md:hidden"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, background: C.bg,
          borderTop: `1px solid ${C.borderSoft}`, display: "flex", justifyContent: "space-around",
          padding: "8px 0", zIndex: 20,
        }}
      >
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setScreen(it.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "6px 12px", borderRadius: 8, border: "none", background: "none", cursor: "pointer",
              fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
              color: screen === it.id ? C.accent : C.mutedDim,
            }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <it.icon size={19} />
              {navBadgeFor(it.id) > 0 && (
                <span
                  style={{
                    position: "absolute", top: -5, right: -7, minWidth: 14, height: 14, padding: "0 3px",
                    borderRadius: 999, background: C.warn, color: "#0a0a0a", fontSize: 8.5, fontWeight: 900,
                    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO,
                  }}
                >
                  {navBadgeFor(it.id) > 9 ? "9+" : navBadgeFor(it.id)}
                </span>
              )}
            </span>
            {it.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------- HOME / MARKET */
function HomeScreen({ listings, loading, onOpenChat, onBuyNow, currentUser, isMinor, isRestricted, ageUnverified, onViewProfile, deepLinkListingId }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [reportTarget, setReportTarget] = useState(null);
  const [likeSummary, setLikeSummary] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [highlightId, setHighlightId] = useState(deepLinkListingId || null);

  useEffect(() => {
    const ids = listings.map((l) => l.id);
    if (!ids.length) return;
    getLikeSummary("listing", ids).then(setLikeSummary).catch(() => {});
    getCommentCounts("listing", ids).then(setCommentCounts).catch(() => {});
  }, [listings]);

  // A shared listing link lands here — scroll straight to it and
  // give it a brief highlight so it's obvious which one was shared.
  useEffect(() => {
    if (!deepLinkListingId || !listings.length) return;
    const el = document.getElementById(`listing-${deepLinkListingId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [deepLinkListingId, listings]);

  const filtered = listings.filter((l) => {
    const matchesCat = cat === "all" || l.category === cat;
    const matchesQ = !query || l.title.toLowerCase().includes(query.toLowerCase()) || l.description.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQ;
  });
  const sorted = filtered.slice().sort((a, b) => b.createdAt - a.createdAt);
  const liveCount = listings.filter((l) => l.status !== "sold").length;

  const chipStyle = (active) => ({
    flexShrink: 0, padding: "7px 14px", borderRadius: 999, fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer",
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : "transparent",
    color: active ? "#0a0a0a" : C.muted,
  });

  const railBtnStyle = (active) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    padding: "9px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    border: "none", textAlign: "left",
    background: active ? C.accentDim : "transparent",
    color: active ? C.accent : C.muted,
  });

  const StatBox = ({ label, value }) => (
    <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
      <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.text }}>{value}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow dot>Live feed · syncs every few seconds</Eyebrow>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>Find it in the trade.</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
          Parts, vehicles, and service providers, posted live by other members.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatBox label="Active" value={String(liveCount).padStart(3, "0")} />
        <StatBox label="Categories" value={CATEGORIES.length} />
        <StatBox label="Showing" value={String(sorted.length).padStart(3, "0")} />
      </div>

      {isMinor && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: C.warnDim, border: `1px solid rgba(255,138,101,0.4)`, borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
          <ShieldCheck size={16} color={C.warn} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: C.warn, lineHeight: 1.5 }}>
            {ageUnverified
              ? "You're browsing in limited mode. Add your birthday in Profile settings to unlock buying and selling."
              : "You're browsing in limited mode. Members under 18 can browse listings and message sellers, but buying and selling unlock at 18."}
          </p>
        </div>
      )}

      {isRestricted && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: C.warnDim, border: `1px solid rgba(255,138,101,0.4)`, borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
          <Flag size={16} color={C.warn} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: C.warn, lineHeight: 1.5 }}>
            Your account is restricted after multiple member complaints. You can still browse and
            message, but buying and selling are paused pending review.
          </p>
        </div>
      )}

      <div className="lg:flex" style={{ gap: 28, alignItems: "flex-start" }}>
        {/* Desktop category rail */}
        <aside className="hidden lg:block" style={{ width: 176, flexShrink: 0, position: "sticky", top: 24 }}>
          <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 8, paddingLeft: 10 }}>
            Categories
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button onClick={() => setCat("all")} style={railBtnStyle(cat === "all")}>
              All listings <span style={{ fontFamily: MONO, fontSize: 10 }}>{listings.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} style={railBtnStyle(cat === c.id)}>
                {c.label}
                <span style={{ fontFamily: MONO, fontSize: 10 }}>{listings.filter((l) => l.category === c.id).length}</span>
              </button>
            ))}
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: 15, color: C.mutedDim }} />
            <Field value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search listings..." style={{ paddingLeft: 38 }} />
          </div>

          {/* Mobile category chips */}
          <div className="lg:hidden" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
            <button onClick={() => setCat("all")} style={chipStyle(cat === "all")}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} style={chipStyle(cat === c.id)}>{c.label}</button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: C.mutedDim, fontSize: 13, fontFamily: MONO }}>Loading listings...</p>
          ) : sorted.length === 0 ? (
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: "60px 20px", textAlign: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>Nothing here yet. Be the first to post in this category.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sorted.map((l, idx) => {
                const CatIcon = CATEGORIES.find((c) => c.id === l.category)?.icon || Wrench;
                return (
                  <div
                    key={l.id}
                    id={`listing-${l.id}`}
                    className="md:flex-row flex-col"
                    style={{
                      display: "flex", gap: 14, background: C.panel, borderRadius: 12, padding: 14,
                      border: `1px solid ${highlightId === l.id ? C.accent : C.border}`,
                      boxShadow: highlightId === l.id ? `0 0 0 3px ${C.accentDim}` : "none",
                      transition: "box-shadow .3s, border-color .3s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.mutedDim, width: 26 }}>{String(idx + 1).padStart(2, "0")}</span>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {l.photos?.[0] ? (
                          <img src={l.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <CatIcon size={19} color={C.accent} />
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
                          {l.type === "service" ? "Service" : "For sale"}
                        </span>
                        {l.status === "sold" && (
                          <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "#0a0a0a", background: C.accent, padding: "2px 6px", borderRadius: 4 }}>Sold</span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.mutedDim, fontFamily: MONO }}>
                          <Clock size={10} /> {timeAgo(l.createdAt)}
                        </span>
                      </div>
                      <h3 style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{l.title}</h3>
                      <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 4 }}>{l.description}</p>
                      {l.location?.lat && (
                        <a
                          href={googleMapsDirectionsUrl(l.location.lat, l.location.lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.accent, marginBottom: 4, textDecoration: "none" }}
                        >
                          <MapPin size={11} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                            {l.location.address}
                          </span>
                        </a>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => onViewProfile(l.seller)}
                          style={{ background: "none", border: "none", color: C.mutedDim, fontFamily: MONO, fontSize: 10, cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
                        >
                          @{l.seller}
                        </button>
                        {l.seller !== currentUser.username && (
                          <button
                            onClick={() => setReportTarget(l)}
                            title="Report this listing"
                            style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                          >
                            <Flag size={11} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
                        <LikeButton
                          targetType="listing"
                          targetId={l.id}
                          initialCount={likeSummary[l.id]?.count || 0}
                          initialLiked={likeSummary[l.id]?.likedByMe || false}
                        />
                        <button
                          onClick={() => setCommentsTarget(l)}
                          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: C.mutedDim }}
                        >
                          <MessageSquare size={13} />
                          <span style={{ fontSize: 12, fontFamily: MONO }}>{commentCounts[l.id] || 0}</span>
                        </button>
                        <ShareButton
                          url={buildShareUrl("listing", l.id)}
                          title={l.title}
                          text={`Check out "${l.title}" on HunT`}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexShrink: 0, minWidth: 128 }}>
                      <span style={{ color: C.gold, fontWeight: 900, fontSize: 15 }}>{l.price ? `$${l.price}` : "Contact"}</span>
                      {l.seller !== currentUser.username && l.status !== "sold" && (
                        <div style={{ display: "flex", gap: 6, width: "100%" }}>
                          {l.type === "item" && l.price ? (
                            <>
                              <Btn
                                style={{ flex: 1, padding: "8px 6px", fontSize: 10.5 }}
                                onClick={() => onBuyNow(l)}
                                disabled={isMinor || isRestricted}
                                title={isMinor ? (ageUnverified ? "Add your birthday in Profile settings to unlock buying" : "Buying unlocks at 18") : isRestricted ? "Buying is paused while your account is under review" : undefined}
                              >
                                {isMinor || isRestricted ? <Lock size={12} /> : <CreditCard size={12} />} Buy
                              </Btn>
                              <Btn variant="ghost" style={{ padding: "8px 10px" }} onClick={() => onOpenChat(l.seller)} title="Message seller">
                                <MessageCircle size={13} />
                              </Btn>
                            </>
                          ) : (
                            <Btn style={{ flex: 1, padding: "8px 6px", fontSize: 10.5 }} onClick={() => onOpenChat(l.seller)}>
                              <MessageCircle size={12} /> Message
                            </Btn>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {reportTarget && (
        <ReportModal listing={reportTarget} onClose={() => setReportTarget(null)} />
      )}

      {commentsTarget && (
        <CommentsModal
          targetType="listing"
          targetId={commentsTarget.id}
          title={commentsTarget.title}
          currentUser={currentUser}
          onClose={() => setCommentsTarget(null)}
          onCountChange={(n) => setCommentCounts((c) => ({ ...c, [commentsTarget.id]: n }))}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- REVIEW MODAL */
function ReviewModal({ order, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await submitReview({
        targetUsername: order.seller,
        listingId: order.listingId,
        listingTitle: order.title,
        rating,
        comment,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || "Couldn't submit your review. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h2 style={{ fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={16} color={C.accent} /> Leave a review
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <CheckCircle size={36} color={C.accent} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Review posted</p>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                Thanks — it's now visible on @{order.seller}'s public profile.
              </p>
              <Btn onClick={onSubmitted} style={{ width: "100%" }}>Done</Btn>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{order.title}</p>
                <p style={{ color: C.mutedDim, fontSize: 11, fontFamily: MONO }}>@{order.seller}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <StarRating value={rating} onChange={setRating} size={26} />
                <p style={{ fontSize: 11, color: C.mutedDim, fontFamily: MONO }}>{rating} / 5</p>
              </div>
              <Field as="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the item and the seller? (optional)" style={{ resize: "none" }} />
              {error && <ErrorNote>{error}</ErrorNote>}
              <Btn type="submit" disabled={busy}>{busy ? "Posting..." : "Post review"}</Btn>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
function PublicProfileModal({ username, allListings, currentUser, onClose, onMessage }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
  const [friendError, setFriendError] = useState("");

  const sendFriend = async () => {
    setFriendBusy(true);
    setFriendError("");
    try {
      await sendFriendRequest(username);
      setFriendSent(true);
    } catch (err) {
      setFriendError(err?.message || "Couldn't send that request.");
    } finally {
      setFriendBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicProfile(username)
      .then((p) => { if (active) setProfile(p); })
      .catch((err) => { if (active) setError(err?.message || "Couldn't load this profile."); })
      .finally(() => { if (active) setLoading(false); });
    getReviews(username).then((r) => { if (active) setReviews(r); }).catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [username]);

  const theirListings = allListings.filter((l) => l.seller === username && l.status !== "sold");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }} className="hunt-scroll">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", top: 0, background: C.bg }}>
          <h2 style={{ fontWeight: 900, fontSize: 17 }}>Profile</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "20px" }}>
          {loading ? (
            <p style={{ color: C.mutedDim, fontSize: 13, fontFamily: MONO }}>Loading...</p>
          ) : error || !profile ? (
            <p style={{ color: C.warn, fontSize: 13 }}>{error || "This member couldn't be found."}</p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <Avatar name={profile.name} url={profile.avatarUrl} size={56} />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 900 }}>{profile.name}</h3>
                  <p style={{ color: C.muted, fontSize: 12, fontFamily: MONO }}>@{profile.username}</p>
                  {profile.reviewCount > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <StarRating value={Math.round(profile.avgRating)} size={12} readOnly />
                      <span style={{ fontSize: 11, color: C.mutedDim, fontFamily: MONO }}>
                        {profile.avgRating} ({profile.reviewCount})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>Member since</p>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
                {profile.age != null && (
                  <div>
                    <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>Age</p>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{profile.age}</p>
                  </div>
                )}
                {profile.contactValue && (
                  <div>
                    <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>
                      {profile.contactMethod === "email" ? "Email" : "Phone"}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{profile.contactValue}</p>
                  </div>
                )}
              </div>

              {profile.username !== currentUser.username && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Btn style={{ flex: 1 }} onClick={() => { onMessage(profile.username); onClose(); }}>
                    <MessageCircle size={14} /> Message
                  </Btn>
                  <Btn
                    variant="ghost"
                    style={{ flex: 1 }}
                    onClick={sendFriend}
                    disabled={friendBusy || friendSent}
                  >
                    {friendSent ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    {friendSent ? "Requested" : "Add friend"}
                  </Btn>
                </div>
              )}
              {friendError && <div style={{ marginBottom: 12 }}><ErrorNote>{friendError}</ErrorNote></div>}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <ShareButton
                  url={buildShareUrl("profile", profile.username)}
                  title={`@${profile.username} on HunT`}
                  text={`Check out @${profile.username} on HunT`}
                  size={13}
                />
              </div>

              <h4 style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                Active listings ({theirListings.length})
              </h4>
              {theirListings.length === 0 ? (
                <p style={{ color: C.mutedDim, fontSize: 13 }}>Nothing listed right now.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {theirListings.map((l) => (
                    <div key={l.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <p style={{ fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</p>
                      <span style={{ color: C.gold, fontWeight: 900, fontSize: 12.5, flexShrink: 0 }}>{l.price ? `$${l.price}` : "Contact"}</span>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10, marginTop: 20 }}>
                Reviews ({reviews.length})
              </h4>
              {reviews.length === 0 ? (
                <p style={{ color: C.mutedDim, fontSize: 13 }}>No reviews yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {reviews.map((r) => (
                    <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <StarRating value={r.rating} size={12} readOnly />
                        <span style={{ fontSize: 10, color: C.mutedDim, fontFamily: MONO }}>{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.comment && <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>{r.comment}</p>}
                      <p style={{ fontSize: 10.5, color: C.mutedDim, fontFamily: MONO }}>
                        @{r.reviewerUsername}{r.listingTitle ? ` · ${r.listingTitle}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 10.5, color: C.mutedDim, lineHeight: 1.6, marginTop: 20 }}>
                HunT only shows a member's name, username, listings, and reviews here — never their
                email, phone, or date of birth, unless they've chosen to make them public.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- REPORT MODAL */
function ReportModal({ listing, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError("Say what happened so this can be reviewed."); return; }
    setError("");
    setBusy(true);
    try {
      await fileReport({ targetUsername: listing.seller, listingId: listing.id, reason: reason.trim() });
      setDone(true);
    } catch (err) {
      setError(err?.message || "Couldn't send the report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h2 style={{ fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Flag size={16} color={C.warn} /> Report listing
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <CheckCircle size={36} color={C.accent} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Report sent</p>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                Thanks — this goes to review. Accounts are only ever restricted after multiple
                separate members report the same issue, never from a single report.
              </p>
              <Btn onClick={onClose} style={{ width: "100%" }}>Done</Btn>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{listing.title}</p>
                <p style={{ color: C.mutedDim, fontSize: 11, fontFamily: MONO }}>@{listing.seller}</p>
              </div>
              <Field as="textarea" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened? (scam attempt, fake listing, harassment, etc.)" style={{ resize: "none" }} />
              {error && <ErrorNote>{error}</ErrorNote>}
              <Btn type="submit" disabled={busy}>{busy ? "Sending..." : "Send report"}</Btn>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- LOCATION PICKER */
function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState(value?.address || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const findAddress = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setBusy(true);
    try {
      const loc = await geocodeAddress(query.trim());
      onChange(loc);
      setQuery(loc.address);
    } catch (err) {
      setError(err?.message || "Couldn't find that location.");
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    setError("");
    setBusy(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const loc = await reverseGeocode(lat, lng);
      onChange(loc);
      setQuery(loc.address);
    } catch (err) {
      setError(err?.message || "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setError("");
  };

  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginLeft: 4, marginBottom: 6 }}>
        <MapPin size={10} /> Pickup location (optional)
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Field
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Address, cross streets, or area"
        />
        <Btn type="button" variant="ghost" onClick={findAddress} disabled={busy} style={{ flexShrink: 0, padding: "0 14px" }}>
          Find
        </Btn>
      </div>
      <button
        type="button"
        onClick={useMyLocation}
        disabled={busy}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 10 }}
      >
        <Navigation size={12} /> {busy ? "Working..." : "Use my current location"}
      </button>

      {error && <div style={{ marginBottom: 10 }}><ErrorNote>{error}</ErrorNote></div>}

      {value?.lat && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 8 }}>
          <iframe
            title="Pickup location preview"
            src={googleMapsEmbedUrl(value.lat, value.lng)}
            width="100%"
            height="180"
            style={{ border: 0, display: "block" }}
            loading="lazy"
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: C.panel }}>
            <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4, paddingRight: 8 }}>{value.address}</span>
            <button type="button" onClick={clear} style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- POST LISTING */
function PostScreen({ user, onPosted, isMinor, isRestricted, ageUnverified }) {
  const [type, setType] = useState("item");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (isRestricted) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ border: `1px solid rgba(255,107,74,0.4)`, background: C.warnDim, borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
          <Flag size={28} color={C.warn} style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontWeight: 900, fontSize: 16, marginBottom: 6, color: C.text }}>Selling is paused</h2>
          <p style={{ color: C.warn, fontSize: 13, lineHeight: 1.6 }}>
            Your account has multiple member complaints against it, so posting is paused pending
            review. You can still browse and message other members.
          </p>
        </div>
      </div>
    );
  }

  if (isMinor) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ border: `1px solid rgba(255,107,74,0.4)`, background: C.warnDim, borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
          <Lock size={28} color={C.warn} style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontWeight: 900, fontSize: 16, marginBottom: 6, color: C.text }}>
            {ageUnverified ? "Add your birthday to sell" : "Selling unlocks at 18"}
          </h2>
          <p style={{ color: C.warn, fontSize: 13, lineHeight: 1.6 }}>
            {ageUnverified
              ? "Posting items or services involves buyers, payment, and shipping details, so we need your birthday first — add it in Profile settings. You can still browse and message sellers."
              : "Posting items or services on HunT involves buyers, payment, and shipping details, so it's limited to members 18 and older. You can still browse the marketplace and message sellers."}
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      const filesToUpload = photos.filter((p) => p.file).map((p) => p.file);
      const uploadedUrls = filesToUpload.length ? await uploadListingPhotos(filesToUpload) : [];
      let uIdx = 0;
      const photoUrls = photos.map((p) => (p.file ? uploadedUrls[uIdx++] : p.url));

      const existing = await window.storage.get("hunt:listings", true).catch(() => null);
      const arr = existing ? JSON.parse(existing.value) : [];
      const listing = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type, category, title: title.trim(), price: price ? Number(price) : null,
        description: description.trim(), location, photos: photoUrls,
        seller: user.username, status: "active", createdAt: Date.now(),
      };
      arr.push(listing);
      await window.storage.set("hunt:listings", JSON.stringify(arr), true);
      setTitle(""); setPrice(""); setDescription(""); setLocation(null); setPhotos([]);
      setDone(true);
      onPosted(arr);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Couldn't post that listing. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const tabStyle = (active) => ({
    flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.03em", border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#0a0a0a" : C.muted,
  });

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
      <Eyebrow dot>Broadcast to the marketplace</Eyebrow>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 6, marginBottom: 4 }}>Post a listing</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
        Sell a part or vehicle, or offer a service. It goes live for everyone right away.
      </p>

      <div style={{ display: "flex", background: C.panel, borderRadius: 10, padding: 4, marginBottom: 16, border: `1px solid ${C.border}` }}>
        {[{ id: "item", label: "Item for sale" }, { id: "service", label: "Service offered" }].map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} style={tabStyle(type === t.id)}>{t.label}</button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "item" ? "e.g. 2016 Alternator, OEM" : "e.g. Mobile tire fitting"} />
        <Field as="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Field>
        <Field value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={type === "item" ? "Price ($, optional)" : "Rate ($, optional)"} />
        <LocationPicker value={location} onChange={setLocation} />
        <Field as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the condition, specs, or scope of work..." style={{ resize: "none" }} />
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={busy} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" disabled={busy}>{busy ? "Posting..." : "Post listing"}</Btn>
        {done && <p style={{ textAlign: "center", fontSize: 12, color: C.accent, fontWeight: 800 }}>Listing is live ✓</p>}
      </form>
    </div>
  );
}

/* ---------------------------------------------------------- EDIT LISTING (modal) */
function EditListingModal({ listing, onClose, onSaved }) {
  const [type, setType] = useState(listing.type || "item");
  const [title, setTitle] = useState(listing.title || "");
  const [category, setCategory] = useState(listing.category || CATEGORIES[0].id);
  const [price, setPrice] = useState(listing.price != null ? String(listing.price) : "");
  const [description, setDescription] = useState(listing.description || "");
  const [location, setLocation] = useState(listing.location || null);
  const [photos, setPhotos] = useState(
    (listing.photos || []).map((url, i) => ({ id: `existing_${i}`, url }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tabStyle = (active) => ({
    flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.03em", border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#0a0a0a" : C.muted,
  });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim()) { setError("Title and description can't be empty."); return; }
    setBusy(true);
    try {
      const filesToUpload = photos.filter((p) => p.file).map((p) => p.file);
      const uploadedUrls = filesToUpload.length ? await uploadListingPhotos(filesToUpload) : [];
      let uIdx = 0;
      const photoUrls = photos.map((p) => (p.file ? uploadedUrls[uIdx++] : p.url));

      // Any original photo the user removed in this edit gets cleaned
      // up from storage too, so it doesn't sit around unreferenced.
      const removedUrls = (listing.photos || []).filter((u) => !photoUrls.includes(u));
      if (removedUrls.length) {
        deleteListingPhotos(removedUrls).catch((err) => console.error("Couldn't clean up removed photos:", err));
      }

      const existing = await window.storage.get("hunt:listings", true).catch(() => null);
      const arr = existing ? JSON.parse(existing.value) : [];
      const updated = arr.map((l) => (l.id === listing.id ? {
        ...l, type, category, title: title.trim(), price: price ? Number(price) : null,
        description: description.trim(), location, photos: photoUrls,
      } : l));
      await window.storage.set("hunt:listings", JSON.stringify(updated), true);
      onSaved(updated);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Couldn't save your changes. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }} className="hunt-scroll">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", top: 0, background: C.bg }}>
          <h2 style={{ fontWeight: 900, fontSize: 17 }}>Edit listing</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={save} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", background: C.panel, borderRadius: 10, padding: 4, border: `1px solid ${C.border}` }}>
            {[{ id: "item", label: "Item for sale" }, { id: "service", label: "Service offered" }].map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} style={tabStyle(type === t.id)}>{t.label}</button>
            ))}
          </div>
          <Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Field as="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Field>
          <Field value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={type === "item" ? "Price ($, optional)" : "Rate ($, optional)"} />
          <LocationPicker value={location} onChange={setLocation} />
          <Field as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ resize: "none" }} />
          <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={busy} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn type="submit" disabled={busy} style={{ flex: 1 }}>{busy ? "Saving..." : "Save changes"}</Btn>
            <Btn type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- CHAT */
function ChatScreen({ user, openWith, setOpenWith, onViewProfile, unreadByUser = {}, markRead, activeChatRef }) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [notifPermission, setNotifPermission] = useState(notificationPermission());
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await window.storage.list("hunt:chat:", true);
      const keys = res?.keys || [];
      const mine = keys.filter((k) => k.includes(user.username));
      const others = mine.map((k) => {
        const parts = k.replace("hunt:chat:", "").split("__");
        return parts.find((p) => p !== user.username) || parts[0];
      });
      setConversations([...new Set(others)]);
    } catch (_) { setConversations([]); }
  }, [user.username]);

  const loadMessages = useCallback(async (other) => {
    if (!other) return;
    try {
      const res = await window.storage.get(chatKey(user.username, other), true);
      setMessages(res ? JSON.parse(res.value) : []);
      // Actively viewing this conversation — keep it marked read as
      // new messages roll in, so the badge doesn't pop back up.
      markRead?.(other);
    } catch (_) { setMessages([]); }
  }, [user.username, markRead]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (activeChatRef) activeChatRef.current = openWith || null;
    if (openWith) { loadMessages(openWith); }
    return () => { if (activeChatRef) activeChatRef.current = null; };
  }, [openWith, loadMessages, activeChatRef]);
  useEffect(() => {
    const iv = setInterval(() => { openWith ? loadMessages(openWith) : loadConversations(); }, 3000);
    return () => clearInterval(iv);
  }, [openWith, loadMessages, loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !openWith) return;
    setDraft("");
    const msg = { from: user.username, text, ts: Date.now() };
    try {
      const key = chatKey(user.username, openWith);
      const res = await window.storage.get(key, true).catch(() => null);
      const arr = res ? JSON.parse(res.value) : [];
      arr.push(msg);
      await window.storage.set(key, JSON.stringify(arr), true);
      setMessages(arr);
      markRead?.(openWith);
      loadConversations();
    } catch (err) { console.error(err); }
  };

  const startNew = () => {
    const t = newTarget.trim().toLowerCase();
    if (!t || t === user.username) return;
    setOpenWith(t);
    setNewTarget("");
  };

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

  if (openWith) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }} className="md:h-screen">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <button onClick={() => setOpenWith(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: C.accent, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12 }}>
            {openWith[0]?.toUpperCase()}
          </div>
          <button
            onClick={() => onViewProfile(openWith)}
            style={{ background: "none", border: "none", fontWeight: 800, fontSize: 13, fontFamily: MONO, color: C.text, cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            @{openWith}
          </button>
        </div>
        <div className="hunt-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: C.mutedDim, fontSize: 12, marginTop: 32 }}>
              Say hello — messages sync every few seconds.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                maxWidth: "75%", padding: "8px 12px", borderRadius: 14, fontSize: 13,
                background: m.from === user.username ? C.accent : C.panel,
                color: m.from === user.username ? "#0a0a0a" : C.text,
                alignSelf: m.from === user.username ? "flex-end" : "flex-start",
              }}
            >
              {m.text}
              <div style={{ fontSize: 9, marginTop: 4, fontFamily: MONO, color: m.from === user.username ? "rgba(0,0,0,0.55)" : C.mutedDim }}>
                {timeAgo(m.ts)}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderTop: `1px solid ${C.borderSoft}` }}>
          <Field value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={{ borderRadius: 999 }} />
          <button onClick={send} style={{ background: C.accent, border: "none", borderRadius: 999, padding: 10, cursor: "pointer", flexShrink: 0 }}>
            <Send size={16} color="#0a0a0a" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
      <Eyebrow dot>Messages sync live</Eyebrow>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 6, marginBottom: 4 }}>Messages</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>Talk directly with buyers and sellers.</p>

      {notificationsSupported() && notifPermission === "default" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.accentDim, border: `1px solid ${C.accentLine}`, borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
          <Bell size={16} color={C.accent} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: C.accent, lineHeight: 1.4, flex: 1 }}>Get notified when someone messages you.</p>
          <button
            onClick={enableNotifications}
            style={{ background: C.accent, color: "#0a0a0a", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", flexShrink: 0 }}
          >
            Enable
          </button>
        </div>
      )}
      {notifPermission === "denied" && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
          <Bell size={14} color={C.mutedDim} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11.5, color: C.mutedDim, lineHeight: 1.5 }}>
            Notifications are blocked for HunT in your browser. Turn them on from your browser's
            site settings to get alerted about new messages.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <Field value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startNew()} placeholder="Start a chat by HunT ID..." />
        <Btn onClick={startNew} style={{ paddingLeft: 18, paddingRight: 18 }}>Chat</Btn>
      </div>

      {conversations.length === 0 ? (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: "50px 20px", textAlign: "center" }}>
          <p style={{ color: C.muted, fontSize: 13 }}>No conversations yet. Message a seller from the marketplace.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {conversations.map((c) => {
            const unread = unreadByUser[c] || 0;
            return (
              <button
                key={c}
                onClick={() => setOpenWith(c)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: C.accent, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12 }}>
                    {c[0]?.toUpperCase()}
                  </div>
                  {unread > 0 && (
                    <span
                      style={{
                        position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, padding: "0 3px",
                        borderRadius: 999, background: C.warn, color: "#0a0a0a", fontSize: 9.5, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO,
                        border: `2px solid ${C.bg}`,
                      }}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: unread > 0 ? 900 : 700, fontSize: 13, color: C.text, fontFamily: MONO }}>@{c}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- FEED */
function visibilityIcon(v) {
  if (v === "friends") return Users;
  if (v === "private") return EyeOff;
  return Globe;
}
function visibilityLabel(v) {
  if (v === "friends") return "Friends";
  if (v === "private") return "Only me";
  return "Public";
}

function FriendsPanel({ friendState, onChanged }) {
  const [open, setOpen] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { friends, incoming, outgoing } = friendState;

  const submitAdd = async (e) => {
    e.preventDefault();
    const u = addUsername.trim();
    if (!u) return;
    setError("");
    setBusy(true);
    try {
      await sendFriendRequest(u);
      setAddUsername("");
      onChanged();
    } catch (err) {
      setError(err?.message || "Couldn't send that request.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (id, accept) => {
    try {
      await respondFriendRequest(id, accept);
      onChanged();
    } catch (err) {
      window.alert(err?.message || "Couldn't update that request.");
    }
  };

  const unfriend = async (id) => {
    if (!window.confirm("Remove this friend?")) return;
    try {
      await removeFriend(id);
      onChanged();
    } catch (err) {
      window.alert(err?.message || "Couldn't remove that friend.");
    }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
          <Users size={15} color={C.accent} /> Friends ({friends.length})
          {incoming.length > 0 && (
            <span style={{ background: C.warn, color: "#0a0a0a", fontSize: 10, fontWeight: 900, borderRadius: 999, padding: "1px 7px" }}>
              {incoming.length} new
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: C.mutedDim, fontFamily: MONO }}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <form onSubmit={submitAdd} style={{ display: "flex", gap: 8 }}>
            <Field value={addUsername} onChange={(e) => setAddUsername(e.target.value)} placeholder="Add friend by HunT ID..." />
            <Btn type="submit" disabled={busy} style={{ paddingLeft: 16, paddingRight: 16 }}><UserPlus size={14} /></Btn>
          </form>
          {error && <ErrorNote>{error}</ErrorNote>}

          {incoming.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 8 }}>Requests</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {incoming.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, borderRadius: 10, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, fontWeight: 700 }}>@{f.username}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => respond(f.id, true)} style={{ background: C.accent, color: "#0a0a0a", border: "none", borderRadius: 999, padding: "4px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>Accept</button>
                      <button onClick={() => respond(f.id, false)} style={{ background: "none", color: C.mutedDim, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 8 }}>Pending</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {outgoing.map((f) => (
                  <span key={f.id} style={{ fontSize: 11, fontFamily: MONO, color: C.mutedDim, background: C.panel2, borderRadius: 999, padding: "4px 10px" }}>@{f.username} · sent</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 8 }}>Friends</p>
            {friends.length === 0 ? (
              <p style={{ color: C.mutedDim, fontSize: 12.5 }}>No friends yet — add one above.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => unfriend(f.id)}
                    title="Remove friend"
                    style={{ fontSize: 11, fontFamily: MONO, color: C.text, background: C.panel2, border: "none", borderRadius: 999, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                  >
                    <UserCheck size={11} color={C.accent} /> @{f.username}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedScreen({ user, deepLinkPostId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatars, setAvatars] = useState({});
  const [likeSummary, setLikeSummary] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [friendState, setFriendState] = useState({ friends: [], incoming: [], outgoing: [] });
  const [filter, setFilter] = useState("all"); // all | videos
  const [highlightId, setHighlightId] = useState(deepLinkPostId || null);

  const [composerText, setComposerText] = useState("");
  const [composerPhotos, setComposerPhotos] = useState([]);
  const [composerVideo, setComposerVideo] = useState(null);
  const [composerVisibility, setComposerVisibility] = useState("public");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadFriends = useCallback(() => {
    getFriendState().then(setFriendState).catch(() => {});
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getFeed();
      setPosts(list);
      const ids = list.map((p) => p.id);
      const [av, likes, counts] = await Promise.all([
        getAvatarsForUsernames(list.map((p) => p.authorUsername)),
        getLikeSummary("post", ids),
        getCommentCounts("post", ids),
      ]);
      setAvatars(av);
      setLikeSummary(likes);
      setCommentCounts(counts);
    } catch (err) {
      console.error("Failed to load feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); loadFriends(); }, [loadFeed, loadFriends]);

  // A shared post link lands here — make sure it's visible under
  // whatever filter is active, scroll to it, and briefly highlight it.
  useEffect(() => {
    if (!deepLinkPostId || !posts.length) return;
    setFilter("all");
    const el = document.getElementById(`post-${deepLinkPostId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [deepLinkPostId, posts]);

  const setPhotosExclusive = (updater) => {
    setComposerVideo(null);
    setComposerPhotos(updater);
  };
  const setVideoExclusive = (v) => {
    setComposerPhotos([]);
    setComposerVideo(v);
  };

  const submitPost = async (e) => {
    e.preventDefault();
    setError("");
    if (!composerText.trim() && composerPhotos.length === 0 && !composerVideo) {
      setError("Write something, or add a photo or video first.");
      return;
    }
    setPosting(true);
    try {
      const filesToUpload = composerPhotos.filter((p) => p.file).map((p) => p.file);
      const uploadedUrls = filesToUpload.length ? await uploadListingPhotos(filesToUpload) : [];
      let uIdx = 0;
      const photoUrls = composerPhotos.map((p) => (p.file ? uploadedUrls[uIdx++] : p.url));
      const videoUrl = composerVideo?.file ? await uploadFeedVideo(composerVideo.file) : null;

      await createPost({ text: composerText, photos: photoUrls, video: videoUrl, visibility: composerVisibility });
      setComposerText(""); setComposerPhotos([]); setComposerVideo(null); setComposerVisibility("public");
      await loadFeed();
    } catch (err) {
      setError(err?.message || "Couldn't post that. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const removePost = async (post) => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await deletePost(post.id);
      if (post.video) deleteFeedVideo(post.video).catch((err) => console.error("Couldn't clean up video:", err));
      setPosts((p) => p.filter((x) => x.id !== post.id));
    } catch (err) {
      window.alert(err?.message || "Couldn't delete that post.");
    }
  };

  const visibilityOptions = [
    { id: "public", label: "Public", icon: Globe },
    { id: "friends", label: "Friends", icon: Users },
    { id: "private", label: "Only me", icon: EyeOff },
  ];

  const visiblePosts = filter === "videos" ? posts.filter((p) => p.video) : posts;
  const videoCount = posts.filter((p) => p.video).length;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <Eyebrow dot>Share something with HunT</Eyebrow>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 6, marginBottom: 4 }}>Feed</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>Post thoughts, photos, or videos — you pick who sees them.</p>

      <FriendsPanel friendState={friendState} onChanged={loadFriends} />

      <form onSubmit={submitPost} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field as="textarea" rows={3} value={composerText} onChange={(e) => setComposerText(e.target.value)} placeholder="What's on your mind?" style={{ resize: "none" }} />
        {!composerVideo && <PhotoPicker photos={composerPhotos} setPhotos={setPhotosExclusive} disabled={posting} />}
        {composerPhotos.length === 0 && <VideoPicker video={composerVideo} setVideo={setVideoExclusive} disabled={posting} />}
        <div style={{ display: "flex", background: C.panel2, borderRadius: 10, padding: 4, border: `1px solid ${C.border}` }}>
          {visibilityOptions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setComposerVisibility(v.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0",
                borderRadius: 8, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", border: "none", cursor: "pointer",
                background: composerVisibility === v.id ? C.accent : "transparent",
                color: composerVisibility === v.id ? "#0a0a0a" : C.muted,
              }}
            >
              <v.icon size={12} /> {v.label}
            </button>
          ))}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" disabled={posting}>{posting ? "Posting..." : "Post"}</Btn>
      </form>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            border: `1px solid ${filter === "all" ? C.accent : C.border}`, cursor: "pointer",
            background: filter === "all" ? C.accent : "transparent", color: filter === "all" ? "#0a0a0a" : C.muted,
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter("videos")}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            border: `1px solid ${filter === "videos" ? C.accent : C.border}`, cursor: "pointer",
            background: filter === "videos" ? C.accent : "transparent", color: filter === "videos" ? "#0a0a0a" : C.muted,
          }}
        >
          <Film size={12} /> Videos ({videoCount})
        </button>
      </div>

      {loading ? (
        <p style={{ color: C.mutedDim, fontSize: 13, fontFamily: MONO }}>Loading feed...</p>
      ) : visiblePosts.length === 0 ? (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: "50px 20px", textAlign: "center" }}>
          <p style={{ color: C.muted, fontSize: 13 }}>
            {filter === "videos" ? "No videos posted yet." : "Nothing here yet. Be the first to post."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visiblePosts.map((p) => {
            const VisIcon = visibilityIcon(p.visibility);
            return (
              <div
                key={p.id}
                id={`post-${p.id}`}
                style={{
                  background: C.panel, borderRadius: 14, padding: 16,
                  border: `1px solid ${highlightId === p.id ? C.accent : C.border}`,
                  boxShadow: highlightId === p.id ? `0 0 0 3px ${C.accentDim}` : "none",
                  transition: "box-shadow .3s, border-color .3s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar name={p.authorUsername} url={avatars[p.authorUsername]} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 13, fontFamily: MONO }}>@{p.authorUsername}</p>
                    <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.mutedDim }}>
                      <Clock size={10} /> {timeAgo(p.createdAt)} <span>·</span> <VisIcon size={10} /> {visibilityLabel(p.visibility)}
                    </p>
                  </div>
                  {p.authorUsername === user.username && (
                    <button onClick={() => removePost(p)} title="Delete post" style={{ background: "none", border: "none", color: C.mutedDim, cursor: "pointer", padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {p.text && <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, marginBottom: (p.photos.length || p.video) ? 10 : 0 }}>{p.text}</p>}

                {p.video ? (
                  <video src={p.video} controls style={{ width: "100%", maxHeight: 400, borderRadius: 10, background: "#000", display: "block" }} />
                ) : p.photos.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: p.photos.length === 1 ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 4, borderRadius: 10, overflow: "hidden" }}>
                    {p.photos.map((url, i) => (
                      <img key={i} src={url} alt="" style={{ width: "100%", height: p.photos.length === 1 ? 280 : 140, objectFit: "cover" }} />
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12 }}>
                  <LikeButton
                    targetType="post"
                    targetId={p.id}
                    initialCount={likeSummary[p.id]?.count || 0}
                    initialLiked={likeSummary[p.id]?.likedByMe || false}
                    size={14}
                  />
                  <button
                    onClick={() => setCommentsTarget(p)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: C.mutedDim }}
                  >
                    <MessageSquare size={14} />
                    <span style={{ fontSize: 12.5, fontFamily: MONO }}>{commentCounts[p.id] || 0}</span>
                  </button>
                  <ShareButton
                    url={buildShareUrl("post", p.id)}
                    title={`@${p.authorUsername} on HunT`}
                    text={p.text ? (p.text.length > 100 ? `${p.text.slice(0, 97)}...` : p.text) : `@${p.authorUsername}'s post on HunT`}
                    size={14}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {commentsTarget && (
        <CommentsModal
          targetType="post"
          targetId={commentsTarget.id}
          title={`@${commentsTarget.authorUsername}'s post`}
          currentUser={user}
          onClose={() => setCommentsTarget(null)}
          onCountChange={(n) => setCommentCounts((c) => ({ ...c, [commentsTarget.id]: n }))}
        />
      )}
    </div>
  );
}


function formatCard(v) { return v.replace(/[^0-9]/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }
function formatExpiry(v) { const d = v.replace(/[^0-9]/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }

function CheckoutModal({ listing, buyer, onClose, onComplete }) {
  const [stage, setStage] = useState("shipping");
  const [shipping, setShipping] = useState({ fullName: buyer.name || "", address: "", city: "", zip: "" });
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toShipping = shipping.fullName.trim() && shipping.address.trim() && shipping.city.trim() && shipping.zip.trim();

  const submitPayment = async (e) => {
    e.preventDefault();
    setError("");
    const digits = card.number.replace(/\s/g, "");
    if (digits.length < 15) { setError("Enter a valid card number."); return; }
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) { setError("Enter expiry as MM/YY."); return; }
    if (card.cvc.length < 3) { setError("Enter a valid CVC."); return; }
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const orderRes = await window.storage.get("hunt:orders", true).catch(() => null);
      const orders = orderRes ? JSON.parse(orderRes.value) : [];
      const order = {
        id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        listingId: listing.id, title: listing.title, price: listing.price,
        buyer: buyer.username, seller: listing.seller, shipping,
        cardLast4: digits.slice(-4), createdAt: Date.now(),
      };
      orders.push(order);
      await window.storage.set("hunt:orders", JSON.stringify(orders), true);

      const listingsRes = await window.storage.get("hunt:listings", true).catch(() => null);
      const allListings = listingsRes ? JSON.parse(listingsRes.value) : [];
      const updated = allListings.map((l) => (l.id === listing.id ? { ...l, status: "sold" } : l));
      await window.storage.set("hunt:listings", JSON.stringify(updated), true);

      const key = chatKey(buyer.username, listing.seller);
      const chatRes = await window.storage.get(key, true).catch(() => null);
      const msgs = chatRes ? JSON.parse(chatRes.value) : [];
      msgs.push({ from: buyer.username, text: `Bought "${listing.title}" for $${listing.price} — shipping to ${shipping.address}, ${shipping.city}.`, ts: Date.now() });
      await window.storage.set(key, JSON.stringify(msgs), true);

      setStage("done");
      onComplete(updated);
    } catch (err) {
      setError("Payment couldn't be processed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="md:items-center">
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }} className="hunt-scroll">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, position: "sticky", top: 0, background: C.bg }}>
          <h2 style={{ fontWeight: 900, fontSize: 17 }}>{stage === "done" ? "Order confirmed" : "Checkout"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {stage !== "done" && (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 13 }}>{listing.title}</p>
                <p style={{ color: C.mutedDim, fontSize: 11, fontFamily: MONO }}>Sold by @{listing.seller}</p>
              </div>
              <span style={{ color: C.gold, fontWeight: 900 }}>${listing.price}</span>
            </div>
          )}

          {stage === "shipping" && (
            <form onSubmit={(e) => { e.preventDefault(); if (toShipping) setStage("payment"); else setError("Fill in every shipping field."); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Eyebrow>
                <Package size={12} style={{ marginRight: 2 }} /> Shipping details
              </Eyebrow>
              <Field value={shipping.fullName} onChange={(e) => setShipping((s) => ({ ...s, fullName: e.target.value }))} placeholder="Full name" />
              <Field value={shipping.address} onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))} placeholder="Street address" />
              <div style={{ display: "flex", gap: 10 }}>
                <Field value={shipping.city} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} placeholder="City" />
                <Field value={shipping.zip} onChange={(e) => setShipping((s) => ({ ...s, zip: e.target.value }))} placeholder="ZIP" style={{ maxWidth: 100 }} />
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
              <Btn type="submit">Continue to payment</Btn>
            </form>
          )}

          {stage === "payment" && (
            <form onSubmit={submitPayment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Eyebrow>
                <Lock size={12} style={{ marginRight: 2 }} /> Payment (demo only, nothing is charged)
              </Eyebrow>
              <Field value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: formatCard(e.target.value) }))} placeholder="Card number" inputMode="numeric" style={{ fontFamily: MONO }} />
              <div style={{ display: "flex", gap: 10 }}>
                <Field value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))} placeholder="MM/YY" inputMode="numeric" style={{ fontFamily: MONO }} />
                <Field value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) }))} placeholder="CVC" inputMode="numeric" style={{ maxWidth: 90, fontFamily: MONO }} />
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
              <Btn type="submit" disabled={busy}>{busy ? "Processing..." : `Pay $${listing.price}`}</Btn>
              <Btn type="button" variant="subtle" onClick={() => setStage("shipping")}>Back</Btn>
            </form>
          )}

          {stage === "done" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircle size={44} color={C.accent} style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 800, marginBottom: 4 }}>You bought {listing.title}</p>
              <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                @{listing.seller} has been notified in your chat. Shipping to {shipping.address}, {shipping.city}.
              </p>
              <Btn onClick={onClose}>Done</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- PRIVATE PERSONAL INFO (editable, privacy toggles) */
function PersonalInfoCard({ user, onProfileUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || "");
  const [dob, setDob] = useState(user.dob || "");
  const [dobPublic, setDobPublic] = useState(!!user.dobPublic);
  const [contactPublic, setContactPublic] = useState(!!user.contactPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const age = calcAge(user.dob);

  const startEditing = () => {
    setName(user.name || "");
    setDob(user.dob || "");
    setDobPublic(!!user.dobPublic);
    setContactPublic(!!user.contactPublic);
    setError("");
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name can't be empty."); return; }
    if (dob) {
      const a = calcAge(dob);
      if (a === null) { setError("Enter a valid date of birth."); return; }
      if (a < ADMIN_MIN_AGE) { setError(`HunT is for members ${ADMIN_MIN_AGE}+ — this date makes you younger than that.`); return; }
    }
    setBusy(true);
    try {
      const patch = await updateProfile({
        name: name.trim(),
        dob: dob || null,
        dobPublic,
        contactPublic,
      });
      onProfileUpdated(patch);
      setEditing(false);
    } catch (err) {
      setError(err?.message || "Couldn't save your changes. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const rowStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
  const labelStyle = { fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 };
  const toggleStyle = { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: C.muted, cursor: "pointer", marginTop: 6 };

  if (!editing) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Personal info</p>
          <button onClick={startEditing} style={{ background: "none", border: "none", color: C.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            Edit
          </button>
        </div>

        <div style={rowStyle}>
          <div>
            <p style={labelStyle}>Member since</p>
            <p style={{ fontSize: 13, fontWeight: 700 }}>{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <p style={labelStyle}>Date of birth</p>
            {user.dob ? (
              <p style={{ fontSize: 13, fontWeight: 700 }}>
                {new Date(user.dob).toLocaleDateString()} <span style={{ color: C.mutedDim, fontWeight: 500 }}>({age} yrs)</span>
              </p>
            ) : (
              <p style={{ fontSize: 13, color: C.warn, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={12} /> Not added — buying &amp; selling stay locked
              </p>
            )}
          </div>
          <span style={{ fontSize: 10, fontFamily: MONO, textTransform: "uppercase", color: C.mutedDim, whiteSpace: "nowrap" }}>
            <Lock size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
            {user.dobPublic ? "Age public" : "Private"}
          </span>
        </div>

        {user.contactValue && (
          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>Linked {user.contactMethod === "email" ? "email" : "phone"}</p>
              <p style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {user.contactValue}
                {user.contactVerified && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: C.accent }}>
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
              </p>
            </div>
            <span style={{ fontSize: 10, fontFamily: MONO, textTransform: "uppercase", color: C.mutedDim, whiteSpace: "nowrap" }}>
              <Lock size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
              {user.contactPublic ? "Public" : "Private"}
            </span>
          </div>
        )}

        <p style={{ fontSize: 10.5, color: C.mutedDim, lineHeight: 1.5 }}>
          Only your name and HunT ID show up on your public profile by default. Turn a field
          public above if you want other members to see it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={save} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Edit personal info</p>

      <div>
        <label style={labelStyle}>Full name</label>
        <div style={{ marginTop: 5 }}>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Date of birth</label>
        <div style={{ marginTop: 5 }}>
          <Field type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <label style={toggleStyle}>
          <input type="checkbox" checked={dobPublic} onChange={(e) => setDobPublic(e.target.checked)} style={{ width: 14, height: 14, accentColor: C.accent }} />
          Show my age (not birthdate) on my public profile
        </label>
      </div>

      {user.contactValue && (
        <label style={toggleStyle}>
          <input type="checkbox" checked={contactPublic} onChange={(e) => setContactPublic(e.target.checked)} style={{ width: 14, height: 14, accentColor: C.accent }} />
          Show my linked {user.contactMethod === "email" ? "email" : "phone"} on my public profile
        </label>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div style={{ display: "flex", gap: 10 }}>
        <Btn type="submit" disabled={busy} style={{ flex: 1 }}>{busy ? "Saving..." : "Save"}</Btn>
        <Btn type="button" variant="ghost" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Btn>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------- APPEARANCE (theme picker) */
function AppearanceCard({ theme, onThemeChange }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
        Appearance
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10 }}>
        {THEME_LIST.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onThemeChange(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px",
                borderRadius: 10, cursor: "pointer", background: t.bg,
                border: `2px solid ${active ? t.accent : "transparent"}`,
                outline: `1px solid ${t.border}`, outlineOffset: -1,
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 999, background: t.accent, border: `1px solid ${t.border}` }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: t.text }}>{t.label}</span>
              {active && <CheckCircle size={11} color={t.accent} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- SECURITY (change password, verified by email) */
function SecurityCard({ user }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const requestChange = async () => {
    if (!user.email) return;
    setBusy(true);
    setError("");
    try {
      await sendPasswordReset(user.email);
      setSent(true);
    } catch (err) {
      setError(err?.message || "Couldn't send the verification email. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
        Security
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Mail size={15} color={C.mutedDim} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim }}>Login email</p>
          <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
        </div>
      </div>

      {sent ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.accentDim, border: `1px solid ${C.accentLine}`, borderRadius: 10, padding: "10px 12px" }}>
          <CheckCircle size={14} color={C.accent} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: C.accent, lineHeight: 1.5 }}>
            Check {user.email} — click the link we sent to verify it's you, then you'll be able to
            set a new password.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: C.mutedDim, lineHeight: 1.5, marginBottom: 12 }}>
            To change your password, we'll send a verification link to your email first — that's
            what confirms it's really you.
          </p>
          <Btn variant="ghost" onClick={requestChange} disabled={busy} style={{ width: "100%" }}>
            <Lock size={14} /> {busy ? "Sending..." : "Change password"}
          </Btn>
        </>
      )}
      {error && <div style={{ marginTop: 10 }}><ErrorNote>{error}</ErrorNote></div>}
    </div>
  );
}

/* ---------------------------------------------------------- ACTIVITY (recent likes/comments on your stuff) */
function NotificationsCard({ items, unreadByUser, onNavigate, onOpenChat }) {
  const messageEntries = Object.entries(unreadByUser || {}).filter(([, count]) => count > 0);
  const [tab, setTab] = useState(messageEntries.length ? "messages" : "activity");

  // Always render this card — even with nothing to show — so it's a
  // predictable, permanent fixture in Profile rather than something
  // that mysteriously vanishes when there's no unread activity yet.

  const tabs = [
    { id: "messages", label: "Messages", count: messageEntries.length },
    { id: "activity", label: "Activity", count: items.length },
  ];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>
          Notifications
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999,
                fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", border: "none", cursor: "pointer",
                background: tab === t.id ? C.accent : C.panel2, color: tab === t.id ? "#0a0a0a" : C.muted,
              }}
            >
              {t.label} {t.count > 0 && <span style={{ fontFamily: MONO }}>({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === "messages" ? (
        messageEntries.length === 0 ? (
          <p style={{ color: C.mutedDim, fontSize: 12.5 }}>No unread messages.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {messageEntries.map(([username, count]) => (
              <button
                key={username}
                onClick={() => onOpenChat?.(username)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.panel2, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MessageCircle size={14} color={C.accent} />
                  <span style={{ fontSize: 12.5, fontFamily: MONO, fontWeight: 800 }}>@{username}</span>
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 900, color: "#0a0a0a", background: C.warn, borderRadius: 999, padding: "2px 8px" }}>
                  {count > 9 ? "9+" : count}
                </span>
              </button>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <p style={{ color: C.mutedDim, fontSize: 12.5 }}>No activity yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.slice(0, 8).map((it) => {
            const Icon = it.type === "like" ? Heart : MessageSquare;
            const verb = it.type === "like" ? "liked" : "commented on";
            const subject = it.kind === "listing" ? `your listing "${it.title || "listing"}"` : "your post";
            return (
              <button
                key={it.id}
                onClick={() => onNavigate?.(it.kind === "listing" ? "home" : "feed")}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, background: C.panel2, border: "none",
                  borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                }}
              >
                <Icon size={14} color={it.type === "like" ? C.warn : C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 800 }}>@{it.actor}</span> {verb} {subject}
                  </p>
                  {it.text && (
                    <p style={{ fontSize: 12, color: C.mutedDim, lineHeight: 1.4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      "{it.text}"
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: C.mutedDim, fontFamily: MONO, marginTop: 3 }}>{timeAgo(it.ts)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- PROFILE */
function ProfileScreen({ user, listings, onLogout, onListingsChanged, onProfileUpdated, theme, onThemeChange, activityFeed = [], onActivitySeen, onNavigate, unreadByUser = {}, onOpenChat }) {
  const mine = listings.filter((l) => l.seller === user.username);
  const [orders, setOrders] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [editingListing, setEditingListing] = useState(null);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  useEffect(() => { onActivitySeen?.(); }, [onActivitySeen]);

  const pickAvatar = () => avatarInputRef.current?.click();

  const onAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const url = await uploadAvatar(file);
      const patch = await updateProfile({ avatarUrl: url });
      onProfileUpdated(patch);
    } catch (err) {
      setAvatarError(err?.message || "Couldn't update your profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("hunt:orders", true);
        setOrders(res ? JSON.parse(res.value) : []);
      } catch (_) { setOrders([]); }
    })();
    getMyReviewedListingIds().then(setReviewedIds).catch(() => setReviewedIds([]));
  }, []);

  const myPurchases = orders.filter((o) => o.buyer === user.username);
  const mySales = orders.filter((o) => o.seller === user.username);

  const removeListing = async (listingId) => {
    if (!window.confirm("Remove this listing? This can't be undone.")) return;
    setDeletingId(listingId);
    try {
      const res = await window.storage.get("hunt:listings", true).catch(() => null);
      const arr = res ? JSON.parse(res.value) : [];
      const target = arr.find((l) => l.id === listingId);
      const updated = arr.filter((l) => l.id !== listingId);
      await window.storage.set("hunt:listings", JSON.stringify(updated), true);
      if (target?.photos?.length) {
        deleteListingPhotos(target.photos).catch((err) => console.error("Couldn't clean up listing photos:", err));
      }
      onListingsChanged(updated);
    } catch (err) {
      console.error("Failed to remove listing:", err);
      window.alert("Couldn't remove that listing. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const Section = ({ title, count, children, empty }) => (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 11, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
        {title} ({count})
      </h2>
      {count === 0 ? <p style={{ color: C.mutedDim, fontSize: 13 }}>{empty}</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>}
    </div>
  );

  const Row = ({ title, sub, badge }) => (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={{ fontWeight: 800, fontSize: 13 }}>{title}</p>
        <p style={{ color: C.mutedDim, fontSize: 11, fontFamily: MONO }}>{sub}</p>
      </div>
      {badge}
    </div>
  );

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div style={{ position: "relative" }}>
          <Avatar name={user.name} url={user.avatarUrl} size={60} onClick={pickAvatar} />
          <button
            onClick={pickAvatar}
            disabled={avatarBusy}
            title="Change profile picture"
            style={{
              position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 999,
              background: C.accent, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", opacity: avatarBusy ? 0.6 : 1,
            }}
          >
            <Camera size={11} color="#0a0a0a" />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarSelected} />
        </div>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 900 }}>{user.name}</h1>
          <p style={{ color: C.muted, fontSize: 13, fontFamily: MONO }}>@{user.username}</p>
        </div>
      </div>
      {avatarError && <div style={{ marginBottom: 12 }}><ErrorNote>{avatarError}</ErrorNote></div>}
      <div style={{ marginBottom: 12 }} />

      <NotificationsCard items={activityFeed} unreadByUser={unreadByUser} onNavigate={onNavigate} onOpenChat={onOpenChat} />

      <PersonalInfoCard user={user} onProfileUpdated={onProfileUpdated} />

      <AppearanceCard theme={theme} onThemeChange={onThemeChange} />

      <SecurityCard user={user} />

      <Section title="My listings" count={mine.length} empty="You haven't posted anything yet.">
        {mine.map((l) => (
          <div key={l.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</p>
              <p style={{ color: C.mutedDim, fontSize: 11, fontFamily: MONO }}>
                {l.price ? `$${l.price}` : "Contact for rate"} · {timeAgo(l.createdAt)}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {l.status === "sold" ? (
                <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "#0a0a0a", background: C.accent, padding: "2px 6px", borderRadius: 4 }}>Sold</span>
              ) : (
                <>
                  <button
                    onClick={() => setEditingListing(l)}
                    title="Edit listing"
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => removeListing(l.id)}
                    disabled={deletingId === l.id}
                    title="Remove listing"
                    style={{ background: "none", border: "none", color: C.warn, cursor: "pointer", padding: 4, display: "flex", alignItems: "center", opacity: deletingId === l.id ? 0.5 : 1 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Section>

      <Section title="My purchases" count={myPurchases.length} empty="Nothing bought yet.">
        {myPurchases.map((o) => (
          <Row
            key={o.id}
            title={o.title}
            sub={`$${o.price} · from @${o.seller} · ${timeAgo(o.createdAt)}`}
            badge={
              reviewedIds.includes(o.listingId) ? (
                <span style={{ fontSize: 10, fontFamily: MONO, textTransform: "uppercase", color: C.mutedDim, display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={11} fill={C.mutedDim} color={C.mutedDim} /> Reviewed
                </span>
              ) : (
                <button
                  onClick={() => setReviewTarget(o)}
                  style={{ background: "none", border: `1px solid ${C.accentLine}`, color: C.accent, borderRadius: 999, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Star size={11} /> Review
                </button>
              )
            }
          />
        ))}
      </Section>

      {mySales.length > 0 && (
        <Section title="My sales" count={mySales.length}>
          {mySales.map((o) => <Row key={o.id} title={o.title} sub={`$${o.price} · to @${o.buyer} · ${timeAgo(o.createdAt)}`} />)}
        </Section>
      )}

      <div className="md:hidden">
        <Btn variant="ghost" onClick={onLogout} style={{ width: "100%" }}>
          <LogOut size={14} /> Log out
        </Btn>
      </div>

      {editingListing && (
        <EditListingModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSaved={(updated) => { onListingsChanged(updated); setEditingListing(null); }}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          order={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => { setReviewedIds((ids) => [...ids, reviewTarget.listingId]); setReviewTarget(null); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- MESSAGE NOTIFICATIONS (global, cross-screen) */
function useMessageNotifications(user) {
  const [unreadByUser, setUnreadByUser] = useState({});
  // Which conversation is actively open + visible right now, so we
  // don't fire a desktop notification for a chat the person is
  // already looking at.
  const activeChatRef = useRef(null);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      const res = await window.storage.list("hunt:chat:", true);
      const keys = (res?.keys || []).filter((k) => k.includes(user.username));
      const counts = {};
      for (const key of keys) {
        const other = key.replace("hunt:chat:", "").split("__").find((p) => p !== user.username);
        if (!other) continue;
        try {
          const r = await window.storage.get(key, true);
          const msgs = r ? JSON.parse(r.value) : [];
          if (!msgs.length) continue;

          const lastRead = getLastRead(user.username, other);
          const unread = msgs.filter((m) => m.from !== user.username && m.ts > lastRead).length;
          if (unread > 0) counts[other] = unread;

          const isActive = activeChatRef.current === other && document.visibilityState === "visible";
          maybeNotifyNewMessage({ me: user.username, other, messages: msgs, isConversationActive: isActive });
        } catch (_) { /* skip this conversation, keep polling the rest */ }
      }
      setUnreadByUser(counts);
    } catch (_) { /* offline or kv_store hiccup — try again next tick */ }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    poll();
    const iv = setInterval(poll, 6000);
    return () => clearInterval(iv);
  }, [user, poll]);

  const markRead = useCallback((other) => {
    if (!user || !other) return;
    setLastRead(user.username, other, Date.now());
    setUnreadByUser((c) => {
      if (!(other in c)) return c;
      const next = { ...c };
      delete next[other];
      return next;
    });
  }, [user]);

  const totalUnread = Object.values(unreadByUser).reduce((a, b) => a + b, 0);
  return { unreadByUser, totalUnread, markRead, activeChatRef };
}

/* ---------------------------------------------------------- ACTIVITY NOTIFICATIONS (likes/comments on your stuff) */
function useActivityNotifications(user, listings) {
  const [activityFeed, setActivityFeed] = useState([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const profileActiveRef = useRef(false);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      const myListings = listings.filter((l) => l.seller === user.username);
      const myPosts = await getFeed({ username: user.username });
      const listingIds = myListings.map((l) => l.id);
      const postIds = myPosts.map((p) => p.id);
      if (!listingIds.length && !postIds.length) return;

      const watermark = getActivityWatermark(user.username);
      const sinceIso = new Date(watermark).toISOString();

      const [listingActivity, postActivity] = await Promise.all([
        getActivitySince({ targetType: "listing", targetIds: listingIds, sinceIso, excludeUsername: user.username }),
        getActivitySince({ targetType: "post", targetIds: postIds, sinceIso, excludeUsername: user.username }),
      ]);

      const items = [];
      for (const l of listingActivity.likes) {
        const listing = myListings.find((x) => x.id === l.target_id);
        items.push({ id: `like-listing-${l.id}`, type: "like", kind: "listing", ts: new Date(l.created_at).getTime(), actor: l.username, title: listing?.title });
      }
      for (const c of listingActivity.comments) {
        const listing = myListings.find((x) => x.id === c.target_id);
        items.push({ id: `comment-listing-${c.id}`, type: "comment", kind: "listing", ts: new Date(c.created_at).getTime(), actor: c.author_username, title: listing?.title, text: c.text });
      }
      for (const l of postActivity.likes) {
        items.push({ id: `like-post-${l.id}`, type: "like", kind: "post", ts: new Date(l.created_at).getTime(), actor: l.username });
      }
      for (const c of postActivity.comments) {
        items.push({ id: `comment-post-${c.id}`, type: "comment", kind: "post", ts: new Date(c.created_at).getTime(), actor: c.author_username, text: c.text });
      }
      if (!items.length) return;

      items.sort((a, b) => b.ts - a.ts);

      // Cap how many actually pop a desktop notification per cycle so
      // a burst of activity doesn't spam the OS notification tray —
      // the rest still land in the in-app Activity list.
      if (!profileActiveRef.current) {
        for (const it of items.slice(0, 3)) {
          showActivityNotification(it);
        }
        setUnseenCount((c) => c + items.length);
      }

      setActivityFeed((prev) => {
        const merged = [...items, ...prev.filter((p) => !items.some((it) => it.id === p.id))];
        return merged.sort((a, b) => b.ts - a.ts).slice(0, 30);
      });

      const maxTs = items.reduce((max, it) => Math.max(max, it.ts), watermark);
      setActivityWatermark(user.username, maxTs);
    } catch (err) {
      console.error("Activity poll failed:", err);
    }
  }, [user, listings]);

  useEffect(() => {
    if (!user) return undefined;
    poll();
    const iv = setInterval(poll, 8000);
    return () => clearInterval(iv);
  }, [user, poll]);

  const markActivitySeen = useCallback(() => setUnseenCount(0), []);

  return { activityFeed, unseenCount, markActivitySeen, profileActiveRef };
}

/* ---------------------------------------------------------- ROOT */
export default function HunT() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [screen, setScreen] = useState("home");
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [openChatWith, setOpenChatWith] = useState(null);
  const [checkoutListing, setCheckoutListing] = useState(null);
  const [viewProfileUsername, setViewProfileUsername] = useState(null);
  const [deepLinkListingId, setDeepLinkListingId] = useState(null);
  const [deepLinkPostId, setDeepLinkPostId] = useState(null);
  const { unreadByUser, totalUnread, markRead, activeChatRef } = useMessageNotifications(user);
  const { activityFeed, unseenCount, markActivitySeen, profileActiveRef } = useActivityNotifications(user, listings);

  // Shared links (from the Share button) land here as ?listing=,
  // ?post=, or ?profile= — open the right screen/item once, then
  // strip the query string so refreshing or navigating away doesn't
  // keep re-triggering it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get("listing");
    const postId = params.get("post");
    const profileUsername = params.get("profile");
    if (listingId) { setScreen("home"); setDeepLinkListingId(listingId); }
    if (postId) { setScreen("feed"); setDeepLinkPostId(postId); }
    if (profileUsername) setViewProfileUsername(profileUsername);
    if (listingId || postId || profileUsername) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Lazy initializer runs during this very render, before the JSX
  // below evaluates any C.xxx — so the saved theme is already live
  // by the time anything actually paints.
  const [theme, setTheme] = useState(() => {
    const saved = loadSavedTheme();
    applyTheme(saved);
    return saved;
  });
  const changeTheme = (id) => { applyTheme(id); setTheme(id); };

  // Clicking a desktop notification jumps straight to that
  // conversation, even if the person was elsewhere in the app.
  useEffect(() => {
    const onOpenChat = (e) => { setScreen("chat"); setOpenChatWith(e.detail); };
    window.addEventListener("hunt:open-chat", onOpenChat);
    return () => window.removeEventListener("hunt:open-chat", onOpenChat);
  }, []);

  // Same idea for a like/comment notification — jumps straight to
  // the Activity list in Profile.
  useEffect(() => {
    const onOpenProfile = () => setScreen("profile");
    window.addEventListener("hunt:open-profile", onOpenProfile);
    return () => window.removeEventListener("hunt:open-profile", onOpenProfile);
  }, []);

  // Track whether Profile is the active screen (and the tab is
  // visible) so activity notifications don't interrupt someone who's
  // already looking at their own Activity list.
  useEffect(() => {
    profileActiveRef.current = screen === "profile" && document.visibilityState === "visible";
  }, [screen, profileActiveRef]);

  // Bootstrap whatever session already exists (e.g. page refresh), then
  // keep `user` in sync with real Supabase Auth state going forward.
  useEffect(() => {
    let active = true;
    getSessionUser()
      .then((u) => { if (active) setUser(u); })
      .catch((err) => console.error("Failed to load session:", err))
      .finally(() => { if (active) setAuthLoading(false); });

    const unsubscribe = onAuthChange((u, event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        return;
      }
      setUser(u);
    });

    return () => { active = false; unsubscribe(); };
  }, []);

  const loadListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await window.storage.get("hunt:listings", true);
      setListings(res ? JSON.parse(res.value) : []);
    } catch (_) { setListings([]); } finally { setLoadingListings(false); }
  }, []);

  useEffect(() => { if (user) loadListings(); }, [user, loadListings]);
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(loadListings, 6000);
    return () => clearInterval(iv);
  }, [user, loadListings]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.mutedDim, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12 }}>
        Loading...
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <ResetPasswordScreen
        onDone={() => {
          setRecoveryMode(false);
          // Force a clean re-check of the session/profile after the
          // password update so the app doesn't sit on stale state.
          getSessionUser().then(setUser).catch(() => setUser(null));
        }}
      />
    );
  }

  if (!user) return <AuthScreen onLogin={setUser} />;

  const age = calcAge(user.dob);
  const ageUnverified = !user.dob;
  // No birthday on file yet is treated the same as "under 18" for
  // gating purposes — buying/selling stay locked until the member adds
  // it themselves in Profile settings, so removing dob from signup
  // doesn't weaken the age gate, just moves it.
  const isMinor = ageUnverified || (age !== null && age < 18);
  const isRestricted = !!user.restricted;

  const goChat = (target) => { setScreen("chat"); setOpenChatWith(target); };

  const handleLogout = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
    setUser(null);
    setScreen("home");
  };

  return (
    <NavShell
      user={user}
      screen={screen}
      setScreen={(s) => { setScreen(s); if (s !== "chat") { setOpenChatWith(null); activeChatRef.current = null; } }}
      onLogout={handleLogout}
      isMinor={isMinor}
      isRestricted={isRestricted}
      ageUnverified={ageUnverified}
      unreadTotal={totalUnread}
      activityCount={unseenCount}
    >
      {screen === "home" && (
        <HomeScreen
          listings={listings}
          loading={loadingListings}
          onOpenChat={goChat}
          onBuyNow={(l) => setCheckoutListing(l)}
          currentUser={user}
          isMinor={isMinor}
          isRestricted={isRestricted}
          ageUnverified={ageUnverified}
          onViewProfile={setViewProfileUsername}
          deepLinkListingId={deepLinkListingId}
        />
      )}
      {screen === "post" && <PostScreen user={user} onPosted={(arr) => setListings(arr)} isMinor={isMinor} isRestricted={isRestricted} ageUnverified={ageUnverified} />}
      {screen === "feed" && <FeedScreen user={user} deepLinkPostId={deepLinkPostId} />}
      {screen === "chat" && (
        <ChatScreen
          user={user}
          openWith={openChatWith}
          setOpenWith={setOpenChatWith}
          onViewProfile={setViewProfileUsername}
          unreadByUser={unreadByUser}
          markRead={markRead}
          activeChatRef={activeChatRef}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          user={user}
          listings={listings}
          onLogout={handleLogout}
          onListingsChanged={(arr) => setListings(arr)}
          onProfileUpdated={(patch) => setUser((u) => ({ ...u, ...patch }))}
          theme={theme}
          onThemeChange={changeTheme}
          activityFeed={activityFeed}
          onActivitySeen={markActivitySeen}
          onNavigate={(s) => setScreen(s)}
          unreadByUser={unreadByUser}
          onOpenChat={goChat}
        />
      )}

      {checkoutListing && !isMinor && !isRestricted && (
        <CheckoutModal listing={checkoutListing} buyer={user} onClose={() => setCheckoutListing(null)} onComplete={(u) => setListings(u)} />
      )}

      {viewProfileUsername && (
        <PublicProfileModal
          username={viewProfileUsername}
          allListings={listings}
          currentUser={user}
          onClose={() => setViewProfileUsername(null)}
          onMessage={goChat}
        />
      )}
    </NavShell>
  );
}
