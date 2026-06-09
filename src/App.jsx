import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

let h2cCache = null;
async function getH2C() {
  if (!h2cCache) {
    const mod = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js");
    h2cCache = mod.default ?? mod;
  }
  return h2cCache;
}

const EXERCISE_CATALOG = [
  { name: "Bench Press",     step: 10 },
  { name: "Overhead Press",  step: 10 },
  { name: "Assisted Pullup", step: 10 },
  { name: "Pullup",          step: 10 },
  { name: "Chinup",          step: 10 },
  { name: "Pushup",          step: 10 },
  { name: "Shoulder Press",  step: 2  },
  { name: "Bicep Curl",      step: 2  },
  { name: "Prone Row",       step: 10 },
];

const MODES = ["strict", "controlled", "momentum", "assisted"];
const MODE = {
  strict:     { color: "#4ade80", bg: "rgba(74,222,128,0.14)",  label: "STRICT"     },
  controlled: { color: "#60a5fa", bg: "rgba(96,165,250,0.14)",  label: "CONTROLLED" },
  momentum:   { color: "#fbbf24", bg: "rgba(251,191,36,0.14)",  label: "MOMENTUM"   },
  assisted:   { color: "#f87171", bg: "rgba(248,113,113,0.14)", label: "ASSISTED"   },
};

function getDateRange(period) {
  const now = new Date(), start = new Date(now);
  if      (period === "daily")   { start.setHours(0,0,0,0); }
  else if (period === "weekly")  { start.setDate(now.getDate()-7); start.setHours(0,0,0,0); }
  else if (period === "monthly") { start.setDate(now.getDate()-30); start.setHours(0,0,0,0); }
  else if (period === "ytd")     { start.setMonth(0,1); start.setHours(0,0,0,0); }
  return start.toISOString();
}

function sessionsToCsv(sessions) {
  const rows = [["session_id","session_date","exercise","set_number","weight_kg","reps","volume","mode","tut_s","rest_s","timestamp"]];
  for (const session of sessions) {
    const d = session.data ?? session;
    const dt = new Date(d.date).toISOString().slice(0,10);
    for (const ex of (d.exercises ?? [])) {
      (ex.sets ?? []).forEach((s, i) => rows.push([
        d.id, dt, ex.name, i+1, s.weight, s.reps, s.weight*s.reps,
        s.executionMode ?? "", s.tut ?? "", s.restAfter ?? "",
        s.timestamp ? new Date(s.timestamp).toISOString() : ""
      ]));
    }
  }
  return rows.map(r => r.join(",")).join("\n");
}

function downloadCsv(content, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

function LoginScreen() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function sendMagicLink() {
    if (!email.trim()) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808", padding:24 }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ fontSize:22, fontWeight:800, letterSpacing:"0.08em", color:"#fff", marginBottom:4 }}>⚔ IRON DOME</div>
        <div style={{ fontSize:12, color:"#475569", marginBottom:32 }}>Sign in to sync your sessions</div>
        {sent ? (
          <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.25)", borderRadius:12, padding:"20px 18px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:12 }}>📬</div>
            <div style={{ color:"#4ade80", fontWeight:700, marginBottom:6 }}>Check your email</div>
            <div style={{ color:"#64748b", fontSize:13 }}>Magic link sent to <strong style={{ color:"#94a3b8" }}>{email}</strong></div>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMagicLink()}
              placeholder="your@email.com"
              style={{ width:"100%", background:"#111", border:"1px solid #252525", color:"#f1f5f9", borderRadius:10, padding:"14px 16px", fontSize:15, fontFamily:"inherit", boxSizing:"border-box", marginBottom:12, outline:"none" }}
              autoFocus
            />
            {error && <div style={{ color:"#f87171", fontSize:12, marginBottom:10 }}>{error}</div>}
            <button
              onClick={sendMagicLink}
              disabled={loading || !email.trim()}
              style={{ width:"100%", background:"#4ade80", border:"none", color:"#000", borderRadius:10, padding:"14px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.06em", opacity: loading || !email.trim() ? 0.5 : 1 }}
            >
              {loading ? "Sending…" : "Send Magic Link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return (
    <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808", color:"#475569", fontSize:13, fontFamily:"'DM Mono',monospace" }}>
      loading…
    </div>
  );

  if (!user) return <LoginScreen />;
  return <IronDomeApp user={user} />;
}

function IronDomeApp({ user }) {
  const [loading,           setLoading]           = useState(true);
  const [exportLoading,     setExportLoading]     = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [showBackupMenu,    setShowBackupMenu]    = useState(false);
  const [backupStatus,      setBackupStatus]      = useState("");
  const [lastBackup,        setLastBackup]        = useState(null);
  const [restTimer,         setRestTimer]         = useState(null);
  const [restElapsed,       setRestElapsed]       = useState(0);

  const sessionRef = useRef(null);
  const restRef    = useRef(null);

  const [session, setSession] = useState({
    id: crypto.randomUUID(), date: new Date().toISOString(), exercises: []
  });
  const [currentExercise, setCurrentExercise] = useState("Bench Press");
  const [weight,    setWeight]    = useState(30);
  const [reps,      setReps]      = useState(12);
  const [modeIndex, setModeIndex] = useState(0);
  const [tut,       setTut]       = useState("");
  const [rest,      setRest]      = useState(90);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(reg => {
      const sw = reg.active || reg.installing || reg.waiting;
      sw?.postMessage({ type: "SCHEDULE_BACKUP" });
    });
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data?.type === "RUN_BACKUP") runAutoBackup();
    });
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  useEffect(() => {
    function onFocus() {
      const now = new Date();
      if (now.getHours() === 19 && now.getMinutes() <= 5) {
        const today = now.toISOString().slice(0,10);
        if (localStorage.getItem("iron-dome-last-backup") !== today) runAutoBackup();
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) onFocus(); });
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => { loadLatestSession(); }, []);

  async function loadLatestSession() {
    const { data } = await supabase
      .from("workouts").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (data?.data) {
      const sessionDate = new Date(data.data.date).toISOString().slice(0,10);
      const today = new Date().toISOString().slice(0,10);
      if (sessionDate < today) startFreshSession();
      else setSession(data.data);
    }
    setLoading(false);
  }

  function startFreshSession() {
    setSession({ id: crypto.randomUUID(), date: new Date().toISOString(), exercises: [] });
  }

  useEffect(() => {
    function schedule() {
      const now = new Date(), midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      return setTimeout(() => { startFreshSession(); schedule(); }, midnight - now);
    }
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => saveSession(session), 700);
    return () => clearTimeout(t);
  }, [session]);

  async function saveSession(updated) {
    const clean = structuredClone(updated);
    await supabase.from("workouts").upsert({ id: clean.id, user_id: user.id, data: clean }, { onConflict: "id" });
  }

  function startRestTimer(seconds) {
    clearInterval(restRef.current);
    setRestTimer(seconds);
    setRestElapsed(0);
    const start = Date.now();
    restRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setRestElapsed(elapsed);
      if (elapsed >= seconds) {
        clearInterval(restRef.current);
        if (Notification.permission === "granted")
          new Notification("Iron Dome", { body: "Rest done — next set!" });
      }
    }, 500);
  }

  async function runAutoBackup() {
    const today = new Date().toISOString().slice(0,10);
    if (localStorage.getItem("iron-dome-last-backup") === today) return;
    localStorage.setItem("iron-dome-last-backup", today);
    setBackupStatus("saving");
    try {
      await Promise.all([exportCsvSilent("daily"), exportJpegSilent()]);
      setLastBackup(new Date().toLocaleTimeString());
      setBackupStatus("done");
      setTimeout(() => setBackupStatus(""), 4000);
    } catch {
      setBackupStatus("error");
      setTimeout(() => setBackupStatus(""), 4000);
    }
  }

  async function exportCsvSilent(period) {
    const since = getDateRange(period);
    const { data, error } = await supabase.from("workouts").select("*")
      .eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: true });
    if (error) throw error;
    if (!data?.length) return;
    downloadCsv(sessionsToCsv(data), `iron-dome-${period}-${new Date().toISOString().slice(0,10)}.csv`);
  }

  async function exportJpegSilent() {
    if (!sessionRef.current) return;
    const h2c = await getH2C();
    const canvas = await h2c(sessionRef.current, { backgroundColor:"#080808", scale:2, useCORS:true, logging:false });
    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `iron-dome-${new Date().toISOString().slice(0,10)}.jpg`;
      a.click();
    }, "image/jpeg", 0.92);
  }

  async function exportCsv(period) {
    setExportLoading(true); setShowBackupMenu(false);
    try { await exportCsvSilent(period); }
    catch (err) { alert("Export failed: " + err.message); }
    finally { setExportLoading(false); }
  }

  async function exportJpeg() {
    setScreenshotLoading(true); setShowBackupMenu(false);
    try { await exportJpegSilent(); }
    catch (err) { alert("Screenshot failed: " + err.message); }
    finally { setScreenshotLoading(false); }
  }

  function addSet() {
    const newSet = {
      weight: Number(weight), reps: Number(reps),
      executionMode: MODES[modeIndex],
      tut: tut ? Number(tut) : null,
      restAfter: Number(rest),
      timestamp: Date.now(),
    };
    setSession(prev => {
      let exercises = prev.exercises.map(ex =>
        ex.name !== currentExercise ? ex : { ...ex, sets: [...ex.sets, newSet] }
      );
      if (!exercises.some(e => e.name === currentExercise))
        exercises = [...exercises, { name: currentExercise, sets: [newSet] }];
      return { ...prev, exercises };
    });
    startRestTimer(Number(rest));
  }

  function deleteSet(exName, index) {
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises
        .map(e => e.name !== exName ? e : { ...e, sets: e.sets.filter((_, i) => i !== index) })
        .filter(e => e.sets.length > 0),
    }));
  }

  function getVolume(ex) {
    return ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  }

  if (loading) return (
    <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808", color:"#475569", fontFamily:"'DM Mono',monospace" }}>
      loading iron dome...
    </div>
  );

  const mode = MODE[MODES[modeIndex]];
  const sessionDate = new Date(session.date).toLocaleDateString("en-IL", { weekday:"long", day:"numeric", month:"long" });
  const totalVol = session.exercises.reduce((s, ex) => s + getVolume(ex), 0);
  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const restPct = restTimer ? Math.min(restElapsed / restTimer, 1) : 0;
  const restDone = restTimer && restElapsed >= restTimer;
  const restLeft = restTimer ? Math.max(restTimer - restElapsed, 0) : null;

  return (
    <div style={S.root}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>⚔ IRON DOME</div>
          <div style={S.date}>{sessionDate}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          <div style={{ display:"flex", gap:6 }}>
            <button style={S.backupBtn} onClick={() => supabase.auth.signOut()} title="Sign out">⏻</button>
          <div style={{ position:"relative" }}>
            <button style={S.backupBtn} onClick={() => setShowBackupMenu(p => !p)} disabled={exportLoading || screenshotLoading}>
              {exportLoading || screenshotLoading ? "⏳" : "💾"} Backup
            </button>
            {showBackupMenu && (
              <>
                <div style={S.overlay} onClick={() => setShowBackupMenu(false)} />
                <div style={S.backupMenu}>
                  <div style={S.menuSection}>CSV Export</div>
                  {["daily","weekly","monthly","ytd"].map(p => (
                    <button key={p} style={S.menuItem} onClick={() => exportCsv(p)}>{p.toUpperCase()}</button>
                  ))}
                  <div style={{ ...S.menuSection, marginTop:10 }}>Screenshot</div>
                  <button style={S.menuItem} onClick={exportJpeg}>Save as JPEG</button>
                  <button style={{ ...S.menuItem, color:"#fbbf24", borderColor:"#3a3000", marginTop:4 }} onClick={() => { setShowBackupMenu(false); startFreshSession(); }}>
                    New Session
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
          {backupStatus === "saving" && <span style={S.bStatus("#fbbf24")}>backing up…</span>}
          {backupStatus === "done"   && <span style={S.bStatus("#4ade80")}>✓ {lastBackup}</span>}
          {backupStatus === "error"  && <span style={S.bStatus("#f87171")}>✗ failed</span>}
        </div>
      </div>

      {/* Stats strip */}
      {totalSets > 0 && (
        <div style={S.statsStrip}>
          <div style={S.stat}><div style={S.statVal}>{totalSets}</div><div style={S.statLbl}>sets</div></div>
          <div style={S.divider} />
          <div style={S.stat}><div style={S.statVal}>{session.exercises.length}</div><div style={S.statLbl}>exercises</div></div>
          <div style={S.divider} />
          <div style={S.stat}><div style={S.statVal}>{totalVol.toLocaleString()}</div><div style={S.statLbl}>kg·reps</div></div>
        </div>
      )}

      {/* Rest timer */}
      {restTimer && (
        <div style={{ ...S.restBar, borderColor: restDone ? "#4ade80" : "#1e1e1e" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ color: restDone ? "#4ade80" : "#e2e8f0", fontWeight:700, fontSize:14 }}>
              {restDone ? "▶  GO" : `REST  ${restLeft}s`}
            </span>
            <button style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:14, padding:"2px 4px" }}
              onClick={() => { clearInterval(restRef.current); setRestTimer(null); }}>✕</button>
          </div>
          <div style={S.restTrack}>
            <div style={{ height:"100%", borderRadius:2, transition:"width .5s linear", width:`${restPct*100}%`, background: restDone ? "#4ade80" : "#60a5fa" }} />
          </div>
        </div>
      )}

      {/* Input card */}
      <div style={S.card}>
        {/* Exercise chips */}
        <div style={S.chips}>
          {EXERCISE_CATALOG.map(e => (
            <button key={e.name}
              style={{ ...S.chip, ...(currentExercise === e.name ? S.chipActive : {}) }}
              onClick={() => setCurrentExercise(e.name)}>
              {e.name}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div style={S.grid}>
          {[
            { label:"Weight kg", val:weight, set:setWeight, step: EXERCISE_CATALOG.find(e=>e.name===currentExercise)?.step ?? 2.5 },
            { label:"Reps",      val:reps,   set:setReps,   step:1 },
          ].map(({ label, val, set, step }) => (
            <label key={label} style={S.fieldLabel}>
              <span style={S.fieldName}>{label}</span>
              <div style={S.inputRow}>
                <button style={S.step} onClick={() => set(v => Math.max(0, Number(v)-step))}>−</button>
                <input type="number" value={val} onChange={e => set(e.target.value)} style={S.input} inputMode="decimal" />
                <button style={S.step} onClick={() => set(v => Number(v)+step)}>+</button>
              </div>
            </label>
          ))}
          <label style={S.fieldLabel}>
            <span style={S.fieldName}>TUT (s)</span>
            <input type="number" value={tut} onChange={e => setTut(e.target.value)} style={{ ...S.input, textAlign:"center" }} inputMode="numeric" placeholder="—" />
          </label>
          <label style={S.fieldLabel}>
            <span style={S.fieldName}>Rest (s)</span>
            <div style={S.inputRow}>
              <button style={S.step} onClick={() => setRest(v => Math.max(0, Number(v)-15))}>−</button>
              <input type="number" value={rest} onChange={e => setRest(e.target.value)} style={S.input} inputMode="numeric" />
              <button style={S.step} onClick={() => setRest(v => Number(v)+15)}>+</button>
            </div>
          </label>
        </div>

        <button onClick={() => setModeIndex(p => (p+1) % MODES.length)}
          style={{ ...S.modeBtn, borderColor:mode.color, color:mode.color, background:mode.bg }}>
          {mode.label} ↻
        </button>
        <button onClick={addSet} style={S.addBtn}>+ LOG SET</button>
      </div>

      {/* Session log */}
      <div ref={sessionRef} style={S.log}>
        <div style={S.logTitle}>SESSION LOG</div>
        {session.exercises.length === 0
          ? <div style={S.empty}>No sets yet — start lifting.</div>
          : session.exercises.map(ex => (
            <div key={ex.name} style={S.exBlock}>
              <div style={S.exHead}>
                <span style={S.exName}>{ex.name}</span>
                <span style={S.volBadge}>{getVolume(ex).toLocaleString()} kg·reps</span>
              </div>
              {ex.sets.map((s, i) => {
                const m = MODE[s.executionMode] ?? { color:"#94a3b8", bg:"rgba(148,163,184,0.1)", label: s.executionMode };
                return (
                  <div key={i} style={S.setRow}>
                    <span style={S.setNum}>{i+1}</span>
                    <span style={S.setMain}>{s.weight}kg × {s.reps}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:99, letterSpacing:"0.06em", fontWeight:700, flexShrink:0, color:m.color, background:m.bg }}>{m.label}</span>
                    {s.tut     && <span style={S.tag}>TUT {s.tut}s</span>}
                    {s.restAfter && <span style={S.tag}>REST {s.restAfter}s</span>}
                    <button onClick={() => deleteSet(ex.name, i)} style={S.delBtn}>✕</button>
                  </div>
                );
              })}
            </div>
          ))
        }
      </div>
    </div>
  );
}

const S = {
  root:       { background:"#050507", minHeight:"100dvh", color:"#e2e8f0", fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif", padding:"20px 16px 80px", maxWidth:540, margin:"0 auto", boxSizing:"border-box" },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 },
  title:      { fontSize:24, fontWeight:800, letterSpacing:"-0.01em", color:"#fff", lineHeight:1 },
  date:       { fontSize:11, color:"#475569", marginTop:4, fontWeight:500, letterSpacing:"0.04em" },

  statsStrip: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", background:"#0d0d10", border:"1px solid #1a1a2e", borderRadius:16, padding:"16px 0", marginBottom:14 },
  stat:       { display:"flex", flexDirection:"column", alignItems:"center", gap:3 },
  statVal:    { fontSize:26, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.02em", lineHeight:1 },
  statLbl:    { fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.14em", fontWeight:600 },
  divider:    { width:1, background:"#1a1a2e", alignSelf:"stretch" },

  restBar:    { background:"#0a0a0d", border:"1px solid #1a1a2e", borderRadius:14, padding:"14px 16px", marginBottom:14 },
  restTrack:  { height:5, background:"#151520", borderRadius:3, overflow:"hidden" },

  backupBtn:  { background:"#0f0f14", border:"1px solid #1e1e2e", color:"#64748b", padding:"9px 14px", borderRadius:10, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:500 },
  overlay:    { position:"fixed", inset:0, zIndex:99 },
  backupMenu: { position:"absolute", right:0, top:"110%", background:"#0f0f14", border:"1px solid #1e1e2e", borderRadius:12, padding:10, zIndex:100, minWidth:180, boxShadow:"0 24px 64px rgba(0,0,0,0.95)" },
  menuSection:{ fontSize:9, color:"#475569", letterSpacing:"0.14em", marginBottom:7, textTransform:"uppercase", fontWeight:600 },
  menuItem:   { display:"block", width:"100%", background:"#141418", border:"1px solid #1e1e2e", color:"#cbd5e1", padding:"10px 13px", borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:5, textAlign:"left", fontWeight:500 },
  bStatus:    c => ({ fontSize:11, color:c, fontWeight:600 }),

  card:       { background:"#0a0a0e", border:"1px solid #151520", borderRadius:18, padding:"18px 16px", marginBottom:14 },
  chips:      { display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 },
  chip:       { background:"#111116", border:"1px solid #1e1e2e", color:"#475569", borderRadius:99, padding:"7px 13px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:500 },
  chipActive: { background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.5)", color:"#a5b4fc", fontWeight:600 },

  grid:       { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 },
  fieldLabel: { display:"flex", flexDirection:"column", gap:6 },
  fieldName:  { fontSize:10, color:"#475569", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 },
  inputRow:   { display:"flex", alignItems:"center", gap:5 },
  input:      { flex:1, background:"#111116", border:"1px solid #1e1e2e", color:"#f1f5f9", padding:"12px 6px", borderRadius:10, fontSize:20, fontFamily:"inherit", boxSizing:"border-box", textAlign:"center", width:"100%", fontWeight:700 },
  step:       { background:"#141418", border:"1px solid #1e1e2e", color:"#64748b", borderRadius:8, padding:"11px 12px", fontSize:17, cursor:"pointer", fontFamily:"inherit", lineHeight:1, flexShrink:0, fontWeight:600 },

  modeBtn:    { width:"100%", background:"transparent", border:"2px solid", padding:"13px", borderRadius:12, fontSize:12, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.12em", fontWeight:800, marginBottom:10 },
  addBtn:     { width:"100%", background:"linear-gradient(135deg,#4ade80,#22d3ee)", border:"none", color:"#000", padding:"16px", borderRadius:12, fontSize:15, fontWeight:800, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.06em", boxShadow:"0 4px 24px rgba(74,222,128,0.25)" },

  log:        { background:"#080809", border:"1px solid #111118", borderRadius:18, padding:"16px 14px" },
  logTitle:   { fontSize:9, color:"#2d3748", letterSpacing:"0.2em", marginBottom:18, textTransform:"uppercase", fontWeight:700 },
  empty:      { color:"#2d3748", fontSize:13, textAlign:"center", padding:"32px 0", fontStyle:"italic" },

  exBlock:    { marginBottom:22 },
  exHead:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  exName:     { fontSize:14, fontWeight:700, color:"#f1f5f9", letterSpacing:"0.02em" },
  volBadge:   { fontSize:11, color:"#4ade80", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", padding:"3px 10px", borderRadius:99, fontWeight:700 },

  setRow:     { display:"flex", alignItems:"center", gap:8, padding:"10px 0", borderBottom:"1px solid #0e0e14" },
  setNum:     { fontSize:10, color:"#2d3748", width:16, textAlign:"right", flexShrink:0, fontWeight:600 },
  setMain:    { fontSize:16, color:"#e2e8f0", fontWeight:700, minWidth:90, letterSpacing:"-0.01em" },
  tag:        { fontSize:10, color:"#64748b", background:"#0f0f14", border:"1px solid #1a1a2e", padding:"2px 7px", borderRadius:6, fontWeight:500 },
  delBtn:     { background:"transparent", border:"none", color:"#2d3748", cursor:"pointer", fontSize:13, padding:"4px 6px", marginLeft:"auto", flexShrink:0 },
};
