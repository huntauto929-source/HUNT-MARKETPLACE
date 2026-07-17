import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, MessageCircle, User, LogOut, X, ChevronLeft,
  Wrench, ShieldCheck, Send, Car, Fuel, Clock, AlertTriangle,
  CreditCard, CheckCircle, Lock, Package, Shield, Radio,
} from "lucide-react";

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

const C = {
  bg: "#0a0a0a",
  panel: "#151513",
  panel2: "#1e1e1a",
  border: "#2c2c26",
  borderSoft: "#1f1f1c",
  accent: "#ffe666",
  accentHover: "#fff2a3",
  accentDim: "rgba(255,230,102,0.14)",
  accentLine: "rgba(255,230,102,0.34)",
  gold: "#ffd23f",
  goldDim: "rgba(255,210,63,0.14)",
  text: "#f6f6f0",
  muted: "#9a9a90",
  mutedDim: "#65655c",
  warn: "#ff8a65",
  warnDim: "rgba(255,138,101,0.14)",
};

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
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function findUserByIdentifier(identifier) {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  try {
    const res = await window.storage.get(`hunt:user:${id}`, true);
    if (res) return JSON.parse(res.value);
  } catch (_) {}
  try {
    const list = await window.storage.list("hunt:user:", true);
    const keys = list?.keys || [];
    for (const k of keys) {
      try {
        const res = await window.storage.get(k, true);
        if (!res) continue;
        const u = JSON.parse(res.value);
        if (u.contactValue && u.contactValue.toLowerCase() === id) return u;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
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
      Secure demo session
    </div>
  );
}

function MinorChip() {
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
      Limited access · under 18
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

/* ---------------------------------------------------------- AUTH SCREEN */
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
  const [mode, setMode] = useState("signup");
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({ name: "", username: "", dob: "", password: "", identifier: "" });
  const [contactMethod, setContactMethod] = useState("email");
  const [contactValue, setContactValue] = useState("");
  const [genCode, setGenCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startVerification = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.username.trim() || !form.dob || !form.password) {
      setError("Fill in every field to create your ID.");
      return;
    }
    if (!USERNAME_RE.test(form.username.trim())) {
      setError("HunT ID can only use letters, numbers, dots, dashes, or underscores — no spaces.");
      return;
    }
    if (!agreed) {
      setError("You need to agree to the Terms and Privacy Notice to create an ID.");
      return;
    }
    const age = calcAge(form.dob);
    if (age === null) { setError("Enter a valid date of birth."); return; }
    if (age < ADMIN_MIN_AGE) {
      setError(`HunT is for members ${ADMIN_MIN_AGE}+. This account can't be created.`);
      return;
    }
    const cv = contactValue.trim();
    if (!cv) { setError(`Add a${contactMethod === "email" ? "n email" : " phone number"} to link.`); return; }
    if (contactMethod === "email" && !EMAIL_RE.test(cv)) { setError("That doesn't look like a valid email."); return; }
    if (contactMethod === "phone" && !PHONE_RE.test(cv)) { setError("That doesn't look like a valid phone number."); return; }

    const uname = form.username.trim().toLowerCase();
    setBusy(true);
    try {
      const exists = await window.storage.get(`hunt:user:${uname}`, true).catch(() => null);
      if (exists) { setError("That ID is already taken. Try another."); setBusy(false); return; }
      const takenBy = await findUserByIdentifier(cv);
      if (takenBy) { setError(`That ${contactMethod} is already linked to another HunT ID.`); setBusy(false); return; }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setGenCode(code);
      setStep("verify");
    } catch (err) {
      console.error("HunT signup (start verification) error:", err);
      setError(`Couldn't start verification: ${err?.message || "unknown error"}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const confirmVerification = async (e) => {
    e.preventDefault();
    setError("");
    if (enteredCode.trim() !== genCode) { setError("That code doesn't match. Check and try again."); return; }
    const uname = form.username.trim().toLowerCase();
    setBusy(true);
    try {
      const passwordHash = await hashPassword(form.password);
      const user = {
        username: uname, name: form.name.trim(), dob: form.dob, passwordHash,
        contactMethod, contactValue: contactValue.trim(), contactVerified: true, createdAt: Date.now(),
      };
      await window.storage.set(`hunt:user:${uname}`, JSON.stringify(user), true);
      onLogin(user);
    } catch (err) {
      console.error("HunT signup (create ID) error:", err);
      setError(`Couldn't create your ID: ${err?.message || "unknown error"}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setError("");
    const id = form.identifier.trim();
    if (!id || !form.password) { setError("Enter your ID, email, or phone, plus your password."); return; }
    setBusy(true);
    try {
      const user = await findUserByIdentifier(id);
      if (!user) { setError("No ID found with that username, email, or phone."); setBusy(false); return; }
      const enteredHash = await hashPassword(form.password);
      const storedHash = user.passwordHash || (user.password ? await hashPassword(user.password) : null);
      if (enteredHash !== storedHash) { setError("Wrong password."); setBusy(false); return; }
      setBusy(false);
      onLogin(user);
    } catch (err) {
      setBusy(false);
      setError("No ID found with that username, email, or phone.");
    }
  };

  const switchMode = (m) => { setMode(m); setStep("form"); setError(""); setEnteredCode(""); };

  const tabStyle = (active) => ({
    flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.03em", border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#0a0a0a" : C.muted,
    transition: "all .15s",
  });

  if (mode === "signup" && step === "verify") {
    return (
      <AuthShell>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo size={34} />
          <div style={{ marginTop: 10 }}>
            <Eyebrow>Verify your {contactMethod}</Eyebrow>
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Sending a code to</p>
          <p style={{ fontWeight: 800, fontFamily: MONO }}>{contactValue}</p>
        </div>

        <div style={{ background: C.accentDim, border: `1px solid ${C.accentLine}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: C.accent, lineHeight: 1.6 }}>
          This demo can't actually send {contactMethod === "email" ? "an email" : "a text"}. Your
          verification code is <span style={{ fontWeight: 900, fontSize: 15, fontFamily: MONO }}>{genCode}</span> — enter it below to prove the flow.
        </div>

        <form onSubmit={confirmVerification} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="000000"
            maxLength={6}
            style={{ textAlign: "center", letterSpacing: "0.5em", fontSize: 20, fontFamily: MONO, paddingLeft: 8 }}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Btn type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify & create my ID"}</Btn>
          <Btn type="button" variant="subtle" onClick={() => setStep("form")}>Back</Btn>
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

      <form onSubmit={mode === "signup" ? startVerification : login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <Field value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Full name" />
        )}
        <Field
          value={mode === "signup" ? form.username : form.identifier}
          onChange={(e) => (mode === "signup" ? update("username", e.target.value) : update("identifier", e.target.value))}
          placeholder={mode === "signup" ? "Choose a HunT ID (username)" : "HunT ID, email, or phone"}
        />
        {mode === "signup" && (
          <div>
            <label style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginLeft: 4 }}>
              Date of birth
            </label>
            <div style={{ marginTop: 5 }}>
              <Field as="input" type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
            </div>
          </div>
        )}
        <Field type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Password" />
        {mode === "signup" && (
          <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.mutedDim, marginLeft: 4 }}>
            <Lock size={10} /> Your password is hashed before it's stored — HunT never saves it as plain text.
          </p>
        )}

        {mode === "signup" && (
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginLeft: 4 }}>
              <Lock size={10} /> Link an account
            </label>
            <div style={{ display: "flex", background: C.panel, borderRadius: 10, padding: 4, marginTop: 6, marginBottom: 8, border: `1px solid ${C.border}` }}>
              {[{ id: "email", label: "Gmail / Email" }, { id: "phone", label: "Phone" }].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setContactMethod(c.id); setContactValue(""); }}
                  style={{ ...tabStyle(contactMethod === c.id), fontSize: 11, padding: "7px 0" }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Field
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              type={contactMethod === "email" ? "email" : "tel"}
              placeholder={contactMethod === "email" ? "you@gmail.com" : "+1 555 123 4567"}
            />
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        {mode === "signup" && (
          <p style={{ fontSize: 10.5, color: C.mutedDim, lineHeight: 1.6, padding: "0 4px" }}>
            You must be {ADMIN_MIN_AGE} or older to create a HunT ID. We'll send a one-time code to
            confirm your {contactMethod === "email" ? "email" : "phone"} before your account is created.
          </p>
        )}

        {mode === "signup" && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 11.5, color: C.muted, padding: "2px 4px", cursor: "pointer", lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, accentColor: C.accent, flexShrink: 0 }}
            />
            <span>
              I agree to HunT's Terms of Use and Privacy Notice, and confirm the account details I've
              given are my own.
            </span>
          </label>
        )}

        <Btn type="submit" disabled={busy}>
          {busy ? "Working..." : mode === "signup" ? "Send verification code" : "Log in"}
        </Btn>
      </form>
    </AuthShell>
  );
}

/* ---------------------------------------------------------- NAV */
function NavShell({ user, screen, setScreen, onLogout, children, isMinor }) {
  const items = [
    { id: "home", label: "Market", icon: Search },
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex" }} className="md:flex-row flex-col">
      <GlobalFX />
      <aside
        className="hidden md:flex"
        style={{ width: 232, flexDirection: "column", borderRight: `1px solid ${C.borderSoft}`, padding: 20 }}
      >
        <Logo />
        <p style={{ fontSize: 11, color: C.mutedDim, marginTop: 4, marginBottom: 12 }}>Automobile marketplace</p>
        {isMinor ? <MinorChip /> : <SecureChip />}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 24 }}>
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setScreen(it.id)}
              onMouseEnter={() => setNavHover(it.id)}
              onMouseLeave={() => setNavHover(null)}
              style={navBtnStyle(it.id)}
            >
              <it.icon size={17} />
              {it.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${C.borderSoft}` }}>
          <p style={{ fontSize: 13, fontWeight: 800 }}>{user.name}</p>
          <p style={{ fontSize: 11, color: C.mutedDim, marginBottom: 10, fontFamily: MONO }}>@{user.username}</p>
          <Btn variant="subtle" onClick={onLogout} style={{ padding: 0 }}>
            <LogOut size={13} /> Log out
          </Btn>
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
        {isMinor ? <MinorChip /> : <SecureChip />}
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
            <it.icon size={19} />
            {it.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------- HOME / MARKET */
function HomeScreen({ listings, loading, onOpenChat, onBuyNow, currentUser, isMinor }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

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
            You're browsing in limited mode. Members under 18 can browse listings and message
            sellers, but buying and selling unlock at 18.
          </p>
        </div>
      )}

      <div className="md:flex" style={{ gap: 28, alignItems: "flex-start" }}>
        {/* Desktop category rail */}
        <aside className="hidden md:block" style={{ width: 176, flexShrink: 0, position: "sticky", top: 24 }}>
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
          <div className="md:hidden" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
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
                    className="sm:flex-row flex-col"
                    style={{ display: "flex", gap: 14, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.mutedDim, width: 26 }}>{String(idx + 1).padStart(2, "0")}</span>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CatIcon size={19} color={C.accent} />
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
                      <span style={{ fontSize: 10, color: C.mutedDim, fontFamily: MONO }}>@{l.seller}</span>
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
                                disabled={isMinor}
                                title={isMinor ? "Buying unlocks at 18" : undefined}
                              >
                                {isMinor ? <Lock size={12} /> : <CreditCard size={12} />} Buy
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
    </div>
  );
}

/* ---------------------------------------------------------- POST LISTING */
function PostScreen({ user, onPosted, isMinor }) {
  const [type, setType] = useState("item");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (isMinor) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ border: `1px solid rgba(255,107,74,0.4)`, background: C.warnDim, borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
          <Lock size={28} color={C.warn} style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontWeight: 900, fontSize: 16, marginBottom: 6, color: C.text }}>Selling unlocks at 18</h2>
          <p style={{ color: C.warn, fontSize: 13, lineHeight: 1.6 }}>
            Posting items or services on HunT involves buyers, payment, and shipping details, so
            it's limited to members 18 and older. You can still browse the marketplace and message
            sellers.
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      const existing = await window.storage.get("hunt:listings", true).catch(() => null);
      const arr = existing ? JSON.parse(existing.value) : [];
      const listing = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type, category, title: title.trim(), price: price ? Number(price) : null,
        description: description.trim(), location: location.trim(),
        seller: user.username, status: "active", createdAt: Date.now(),
      };
      arr.push(listing);
      await window.storage.set("hunt:listings", JSON.stringify(arr), true);
      setTitle(""); setPrice(""); setDescription(""); setLocation("");
      setDone(true);
      onPosted(arr);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      console.error(err);
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
        <Field value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (city, optional)" />
        <Field as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the condition, specs, or scope of work..." style={{ resize: "none" }} />
        <Btn type="submit" disabled={busy}>{busy ? "Posting..." : "Post listing"}</Btn>
        {done && <p style={{ textAlign: "center", fontSize: 12, color: C.accent, fontWeight: 800 }}>Listing is live ✓</p>}
      </form>
    </div>
  );
}

/* ---------------------------------------------------------- CHAT */
function ChatScreen({ user, openWith, setOpenWith }) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [newTarget, setNewTarget] = useState("");
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
    } catch (_) { setMessages([]); }
  }, [user.username]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (openWith) loadMessages(openWith); }, [openWith, loadMessages]);
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
      loadConversations();
    } catch (err) { console.error(err); }
  };

  const startNew = () => {
    const t = newTarget.trim().toLowerCase();
    if (!t || t === user.username) return;
    setOpenWith(t);
    setNewTarget("");
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
          <span style={{ fontWeight: 800, fontSize: 13, fontFamily: MONO }}>@{openWith}</span>
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
          {conversations.map((c) => (
            <button
              key={c}
              onClick={() => setOpenWith(c)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 999, background: C.accent, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                {c[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text, fontFamily: MONO }}>@{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- CHECKOUT */
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

/* ---------------------------------------------------------- PROFILE */
function ProfileScreen({ user, listings, onLogout }) {
  const mine = listings.filter((l) => l.seller === user.username);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("hunt:orders", true);
        setOrders(res ? JSON.parse(res.value) : []);
      } catch (_) { setOrders([]); }
    })();
  }, []);

  const myPurchases = orders.filter((o) => o.buyer === user.username);
  const mySales = orders.filter((o) => o.seller === user.username);

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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 999, background: C.accent, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 22 }}>
          {user.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 900 }}>{user.name}</h1>
          <p style={{ color: C.muted, fontSize: 13, fontFamily: MONO }}>@{user.username}</p>
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>Member since</p>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
        {user.contactValue && (
          <div>
            <p style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutedDim, marginBottom: 3 }}>
              Linked {user.contactMethod === "email" ? "email" : "phone"}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {user.contactValue}
              {user.contactVerified && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: C.accent }}>
                  <ShieldCheck size={12} /> Verified
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <Section title="My listings" count={mine.length} empty="You haven't posted anything yet.">
        {mine.map((l) => (
          <Row
            key={l.id}
            title={l.title}
            sub={`${l.price ? `$${l.price}` : "Contact for rate"} · ${timeAgo(l.createdAt)}`}
            badge={l.status === "sold" && (
              <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "#0a0a0a", background: C.accent, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>Sold</span>
            )}
          />
        ))}
      </Section>

      <Section title="My purchases" count={myPurchases.length} empty="Nothing bought yet.">
        {myPurchases.map((o) => <Row key={o.id} title={o.title} sub={`$${o.price} · from @${o.seller} · ${timeAgo(o.createdAt)}`} />)}
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
    </div>
  );
}

/* ---------------------------------------------------------- ROOT */
export default function HunT() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [openChatWith, setOpenChatWith] = useState(null);
  const [checkoutListing, setCheckoutListing] = useState(null);

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

  if (!user) return <AuthScreen onLogin={setUser} />;

  const age = calcAge(user.dob);
  const isMinor = age !== null && age < 18;

  const goChat = (target) => { setScreen("chat"); setOpenChatWith(target); };

  return (
    <NavShell
      user={user}
      screen={screen}
      setScreen={(s) => { setScreen(s); if (s !== "chat") setOpenChatWith(null); }}
      onLogout={() => { setUser(null); setScreen("home"); }}
      isMinor={isMinor}
    >
      {screen === "home" && (
        <HomeScreen
          listings={listings}
          loading={loadingListings}
          onOpenChat={goChat}
          onBuyNow={(l) => setCheckoutListing(l)}
          currentUser={user}
          isMinor={isMinor}
        />
      )}
      {screen === "post" && <PostScreen user={user} onPosted={(arr) => setListings(arr)} isMinor={isMinor} />}
      {screen === "chat" && <ChatScreen user={user} openWith={openChatWith} setOpenWith={setOpenChatWith} />}
      {screen === "profile" && <ProfileScreen user={user} listings={listings} onLogout={() => setUser(null)} />}

      {checkoutListing && !isMinor && (
        <CheckoutModal listing={checkoutListing} buyer={user} onClose={() => setCheckoutListing(null)} onComplete={(u) => setListings(u)} />
      )}
    </NavShell>
  );
}
