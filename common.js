/* =========================================================
   FLOW — common.js
   Shared across index.html (Dashboard) and task.html (Tasks).
   Load this BEFORE script.js / task.js on each page.
========================================================= */

/* ---------------------------------------------------------
   DATA STORE
--------------------------------------------------------- */
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

function loadState() {
  state.tasks = DataStore.getTasks() ?? SEED_TASKS;
  state.agenda = DataStore.getAgenda() ?? SEED_AGENDA;
  state.habits = DataStore.getHabits() ?? SEED_HABITS;
  state.goals = DataStore.getGoals() ?? SEED_GOALS;
  state.user = DataStore.getUser() ?? { name: "Pogi" };
  state.stats = DataStore.getStats() ?? { completedToday: 0, focusSessionsToday: 0 };
  if (state.stats.focusSessionsToday === undefined) state.stats.focusSessionsToday = 0;

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
function persistStats() { DataStore.setStats(state.stats); }

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayDueTasks() {
  const today = todayISO();
  return state.tasks.filter((t) => !t.done && (!t.scheduledDate || t.scheduledDate <= today));
}

const SEED_AGENDA = [
  { id: "a1", title: "Programming Class", description: "", time: "09:00", date: todayISO(), done: false },
  { id: "a2", title: "Study Java", description: "", time: "13:00", date: todayISO(), done: false },
  { id: "a3", title: "Gym", description: "", time: "18:00", date: todayISO(), done: false },
];

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
   (used identically on both pages)
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

  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      showToast("Settings coming soon");
    });
  }
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