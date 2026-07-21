const DataStore = (() => {
  const KEYS = {
    tasks: "flow.tasks",
    agenda: "flow.agenda",
    habits: "flow.habits",
    user: "flow.user",
    stats: "flow.stats",
    goals: "flow.goals",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  return {
    getTasks: () => read(KEYS.tasks, null),
    setTasks: (tasks) => write(KEYS.tasks, tasks),

    getAgenda: () => read(KEYS.agenda, null),
    setAgenda: (items) => write(KEYS.agenda, items),

    getHabits: () => read(KEYS.habits, null),
    setHabits: (habits) => write(KEYS.habits, habits),

    getUser: () => read(KEYS.user, null),
    setUser: (user) => write(KEYS.user, user),

    getStats: () => read(KEYS.stats, null),
    setStats: (stats) => write(KEYS.stats, stats),

    getGoals: () => read(KEYS.goals, null),
    setGoals: (goals) => write(KEYS.goals, goals),
  };
})();

/* ---------------------------------------------------------
   SEED DATA (used only on first ever load)
--------------------------------------------------------- */
const SEED_TASKS = [
  { id: "t1", title: "Review notes for networking exam", priority: "high", time: "09:00", status: "in-progress", dueDate: "", scheduledDate: "", done: false },
  { id: "t2", title: "Study Java fundamentals", priority: "medium", time: "13:00", status: "in-progress", dueDate: "", scheduledDate: "", done: false },
  { id: "t3", title: "Push updates to capstone repo", priority: "medium", time: "16:00", status: "not-started", dueDate: "", scheduledDate: "", done: false },
];

const SEED_HABITS = [
  { id: "h1", emoji: "💧", name: "Drink Water", target: 8, progress: 3 },
  { id: "h2", emoji: "📖", name: "Study", target: 2, progress: 1 },
  { id: "h3", emoji: "🏋", name: "Gym", target: 1, progress: 0 },
  { id: "h4", emoji: "😴", name: "Sleep 8h", target: 1, progress: 0 },
];

const SEED_GOALS = [
  {
    id: "g1",
    title: "Prep for Java",
    phases: [
      { id: "g1p1", title: "Phase 1: Fundamentals", done: false },
      { id: "g1p2", title: "Phase 2: OOP", done: false },
      { id: "g1p3", title: "Phase 3: Collections & Generics", done: false },
      { id: "g1p4", title: "Phase 4: Practice Problems", done: false },
    ],
  },
];

/* ---------------------------------------------------------
   SHARED STATE
--------------------------------------------------------- */
const state = {
  tasks: [],
  agenda: [],
  habits: [],
  goals: [],
  user: { name: "Pogi" },
  stats: { completedToday: 0, focusSessionsToday: 0 },
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const SEED_AGENDA = [
  { id: "a1", title: "Programming Class", description: "", time: "09:00", date: todayISO(), done: false },
  { id: "a2", title: "Study Java", description: "", time: "13:00", date: todayISO(), done: false },
  { id: "a3", title: "Gym", description: "", time: "18:00", date: todayISO(), done: false },
];

// Defensive Array.isArray/typeof checks mean corrupted or tampered
// localStorage data (or a missing field from an older version)
// falls back to a safe default instead of crashing the app.
function loadState() {
  const rawTasks = DataStore.getTasks();
  const rawAgenda = DataStore.getAgenda();
  const rawHabits = DataStore.getHabits();
  const rawGoals = DataStore.getGoals();
  const rawUser = DataStore.getUser();
  const rawStats = DataStore.getStats();

  state.tasks = Array.isArray(rawTasks) ? rawTasks : SEED_TASKS;
  state.agenda = Array.isArray(rawAgenda) ? rawAgenda : SEED_AGENDA;
  state.habits = Array.isArray(rawHabits) ? rawHabits : SEED_HABITS;
  state.goals = Array.isArray(rawGoals) ? rawGoals : SEED_GOALS;
  state.user = rawUser && typeof rawUser === "object" ? rawUser : { name: "Pogi" };
  state.stats = rawStats && typeof rawStats === "object" ? rawStats : { completedToday: 0, focusSessionsToday: 0 };
  if (typeof state.stats.focusSessionsToday !== "number") state.stats.focusSessionsToday = 0;
  if (typeof state.stats.completedToday !== "number") state.stats.completedToday = 0;

  // Sweep out any leftover done tasks so they don't sit in the array forever
  const leftoverDone = state.tasks.filter((t) => t.done).length;
  if (leftoverDone > 0) {
    state.stats.completedToday += leftoverDone;
    state.tasks = state.tasks.filter((t) => !t.done);
  }

  DataStore.setTasks(state.tasks);
  DataStore.setAgenda(state.agenda);
  DataStore.setHabits(state.habits);
  DataStore.setGoals(state.goals);
  DataStore.setUser(state.user);
  DataStore.setStats(state.stats);
}

function persistTasks() { DataStore.setTasks(state.tasks); }
function persistAgenda() { DataStore.setAgenda(state.agenda); }
function persistHabits() { DataStore.setHabits(state.habits); }
function persistGoals() { DataStore.setGoals(state.goals); }
function persistStats() { DataStore.setStats(state.stats); }

/* ---------------------------------------------------------
   GOALS — shared phase logic (used by dashboard + goals page)
--------------------------------------------------------- */
function goalProgress(goal) {
  const total = goal.phases.length;
  const done = goal.phases.filter((p) => p.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Index of the first not-yet-done phase, or -1 if every phase is done.
function currentPhaseIndex(goal) {
  return goal.phases.findIndex((p) => !p.done);
}

// Phases must be completed in order. You can check the current phase,
// or uncheck the most recently completed one (to fix a mistake) —
// but you can never skip ahead or edit an older locked phase.
function canTogglePhase(goal, index) {
  const cur = currentPhaseIndex(goal);
  if (cur === -1) return index === goal.phases.length - 1;
  return index === cur || index === cur - 1;
}

/* ---------------------------------------------------------
   SHARED HELPERS
--------------------------------------------------------- */
function formatTime12h(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDatePretty(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTodayDueTasks() {
  const today = todayISO();
  return state.tasks.filter((t) => !t.done && (!t.scheduledDate || t.scheduledDate <= today));
}

// Trims and hard-caps user-entered text before it's stored, so a
// pasted wall of text can't bloat storage or break card layouts.
function clampText(str, maxLen) {
  return (str ?? "").toString().trim().slice(0, maxLen);
}

// Escapes user-entered text before it's inserted via innerHTML —
// the core defense against XSS. Every field rendered from state
// (task titles, descriptions, goal/phase titles, habit names and
// emoji, etc.) is passed through this before being templated in.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2200);
}

/* ---------------------------------------------------------
   SHARED UI: sidebar toggle + modal open/close
--------------------------------------------------------- */
function initSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("sidebarScrim");
  const openBtns = [document.getElementById("hamburgerBtn"), document.getElementById("hamburgerBtnMobile")];

  function open() { sidebar.classList.add("open"); scrim.classList.add("show"); }
  function close() { sidebar.classList.remove("open"); scrim.classList.remove("show"); }

  openBtns.forEach((btn) => btn && btn.addEventListener("click", () => {
    sidebar.classList.contains("open") ? close() : open();
  }));
  scrim.addEventListener("click", close);

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => close());
  });
}

function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }
function initModalCloseButtons() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach((o) => { o.hidden = true; });
    }
  });
}

/* ---------------------------------------------------------
   THEME SWITCHER
   Boy/Girl x Light/Dark. Applies instantly and persists
   across pages via a plain localStorage preference.
--------------------------------------------------------- */
const THEME_KEY = "flow.theme";
const THEME_FILES = {
  "boy-dark": "style.css",
  "boy-light": "style-light.css",
  "girl-dark": "style-pink.css",
  "girl-light": "style-lightpink.css",
};

function getSavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEME_FILES[saved] ? saved : "boy-dark";
}

function applyTheme(themeId) {
  const link = document.getElementById("themeLink");
  if (link && THEME_FILES[themeId]) {
    link.setAttribute("href", THEME_FILES[themeId]);
  }
  localStorage.setItem(THEME_KEY, themeId);
}

function injectThemeModalStyles() {
  if (document.getElementById("flow-theme-style")) return;
  const style = document.createElement("style");
  style.id = "flow-theme-style";
  style.textContent = `
    #flowThemeOverlay { position:fixed; inset:0; background:rgba(2,6,23,0.6); backdrop-filter:blur(4px); z-index:9998; display:flex; align-items:center; justify-content:center; padding:20px; }
    #flowThemeOverlay[hidden] { display:none !important; }
    .flow-theme-card { background:var(--sidebar,#1E293B); border:1px solid var(--border-strong,rgba(148,163,184,0.22)); border-radius:16px; padding:24px; width:100%; max-width:360px; font-family:'Inter',sans-serif; box-shadow:0 16px 36px rgba(0,0,0,0.3); }
    .flow-theme-card h3 { margin:0 0 4px; font-size:16px; color:var(--text,#F8FAFC); font-family:'Inter Tight',sans-serif; }
    .flow-theme-card p { margin:0 0 16px; font-size:12.5px; color:var(--text-secondary,#94A3B8); }
    .flow-theme-group { margin-bottom:14px; }
    .flow-theme-group-label { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary,#94A3B8); margin-bottom:8px; }
    .flow-theme-options { display:flex; gap:8px; }
    .flow-theme-opt { flex:1; padding:10px; border-radius:10px; border:1.5px solid var(--border-strong,rgba(148,163,184,0.22)); background:transparent; color:var(--text,#F8FAFC); font-size:13px; font-weight:600; cursor:pointer; }
    .flow-theme-opt.active { border-color:var(--primary,#6366F1); background:var(--primary-soft,rgba(99,102,241,0.16)); }
    .flow-theme-close { width:100%; margin-top:8px; padding:10px; border:none; border-radius:999px; background:var(--primary,#6366F1); color:#fff; font-weight:700; font-size:13px; cursor:pointer; }
  `;
  document.head.appendChild(style);
}

function ensureThemeModal() {
  if (document.getElementById("flowThemeOverlay")) return;
  injectThemeModalStyles();

  const overlay = document.createElement("div");
  overlay.id = "flowThemeOverlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="flow-theme-card">
      <h3>🎨 Theme</h3>
      <p>Pick a look — applies right away and stays on every page.</p>
      <div class="flow-theme-group">
        <div class="flow-theme-group-label">Style</div>
        <div class="flow-theme-options" id="flowThemeGender">
          <button type="button" class="flow-theme-opt" data-gender="boy">Boy</button>
          <button type="button" class="flow-theme-opt" data-gender="girl">Girl</button>
        </div>
      </div>
      <div class="flow-theme-group">
        <div class="flow-theme-group-label">Mode</div>
        <div class="flow-theme-options" id="flowThemeMode">
          <button type="button" class="flow-theme-opt" data-mode="light">Light</button>
          <button type="button" class="flow-theme-opt" data-mode="dark">Dark</button>
        </div>
      </div>
      <button type="button" class="flow-theme-close" id="flowThemeCloseBtn">Done</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
  document.getElementById("flowThemeCloseBtn").addEventListener("click", () => {
    overlay.hidden = true;
  });

  function currentParts() {
    const current = getSavedTheme(); // e.g. "boy-dark"
    const [gender, mode] = current.split("-");
    return { gender, mode };
  }

  function refreshActiveButtons() {
    const { gender, mode } = currentParts();
    document.querySelectorAll("#flowThemeGender .flow-theme-opt").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.gender === gender);
    });
    document.querySelectorAll("#flowThemeMode .flow-theme-opt").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  document.getElementById("flowThemeGender").addEventListener("click", (e) => {
    const btn = e.target.closest(".flow-theme-opt");
    if (!btn) return;
    const { mode } = currentParts();
    applyTheme(`${btn.dataset.gender}-${mode}`);
    refreshActiveButtons();
  });
  document.getElementById("flowThemeMode").addEventListener("click", (e) => {
    const btn = e.target.closest(".flow-theme-opt");
    if (!btn) return;
    const { gender } = currentParts();
    applyTheme(`${gender}-${btn.dataset.mode}`);
    refreshActiveButtons();
  });

  refreshActiveButtons();
}

function initThemeSwitcher() {
  applyTheme(getSavedTheme());

  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      ensureThemeModal();
      document.getElementById("flowThemeOverlay").hidden = false;
    });
  }
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", initThemeSwitcher);