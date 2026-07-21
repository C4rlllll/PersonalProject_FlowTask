const PRESETS = {
  classic: [
    { type: "work", label: "Focus", seconds: 25 * 60 },
    { type: "break", label: "Break", seconds: 5 * 60 },
  ],
  exam: [
    { type: "work", label: "Review", seconds: 25 * 60 },
    { type: "break", label: "Break", seconds: 5 * 60 },
    { type: "work", label: "Self-Test", seconds: 15 * 60 },
    { type: "break", label: "Break", seconds: 15 * 60 },
  ],
};

/* ---------------------------------------------------------
   SESSION STATE (in-memory only — resets on page reload)
--------------------------------------------------------- */
const session = {
  active: false,
  paused: false,
  presetKey: "classic",
  phases: [],
  phaseIndex: 0,
  secondsLeft: 0,
  timerId: null,
  linkedTaskId: "",
  workPhasesCompleted: 0,
  sessionsTarget: 4,
};

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------------------------------------------------------
   SETUP PANEL
--------------------------------------------------------- */
function populateTaskSelect() {
  const select = document.getElementById("focusTaskSelect");
  const dueTasks = getTodayDueTasks();

  select.innerHTML = '<option value="">Just focus — no linked task</option>';
  dueTasks.forEach((task) => {
    const opt = document.createElement("option");
    opt.value = task.id;
    opt.textContent = task.title;
    select.appendChild(opt);
  });
}

function renderSessionsPill() {
  document.getElementById("focusSessionsPill").textContent = `${state.stats.focusSessionsToday} sessions today`;
}

/* ---------------------------------------------------------
   TIMER PANEL RENDERING
--------------------------------------------------------- */
const RING_CIRCUMFERENCE = 2 * Math.PI * 118;

function renderPhaseDots() {
  const wrap = document.getElementById("focusPhaseDots");
  wrap.innerHTML = "";
  session.phases.forEach((phase, i) => {
    const dot = document.createElement("span");
    dot.className = `focus-dot focus-dot-${phase.type}`;
    if (i === session.phaseIndex) dot.classList.add("current");
    if (i < session.phaseIndex) dot.classList.add("past");
    wrap.appendChild(dot);
  });
}

function renderTimerTick() {
  const phase = session.phases[session.phaseIndex];
  document.getElementById("focusPhaseLabel").textContent = phase.label;
  document.getElementById("focusClockTime").textContent = formatClock(session.secondsLeft);
  document.getElementById("focusCycleLabel").textContent =
    `Work session ${session.workPhasesCompleted + (phase.type === "work" ? 1 : 0)} of ${session.sessionsTarget}`;

  const elapsedRatio = 1 - session.secondsLeft / phase.seconds;
  const offset = RING_CIRCUMFERENCE - Math.max(0, Math.min(1, elapsedRatio)) * RING_CIRCUMFERENCE;
  const ring = document.getElementById("focusRingFill");
  ring.classList.toggle("focus-ring-break", phase.type === "break");
  ring.style.strokeDashoffset = offset;

  renderPhaseDots();
}

/* ---------------------------------------------------------
   SESSION CONTROL
--------------------------------------------------------- */
function startSession() {
  const presetKey = document.getElementById("focusPreset").value;
  const taskId = document.getElementById("focusTaskSelect").value;
  const target = Math.max(1, Number(document.getElementById("focusSessionsTarget").value) || 1);

  session.active = true;
  session.paused = false;
  session.presetKey = presetKey;
  session.phases = PRESETS[presetKey];
  session.phaseIndex = 0;
  session.secondsLeft = session.phases[0].seconds;
  session.linkedTaskId = taskId;
  session.workPhasesCompleted = 0;
  session.sessionsTarget = target;

  const task = state.tasks.find((t) => t.id === taskId);
  document.getElementById("focusLinkedTaskLabel").textContent = task ? `Focusing on: ${task.title}` : "Focusing";

  document.getElementById("focusSetupPanel").hidden = true;
  document.getElementById("focusTimerPanel").hidden = false;
  document.getElementById("pauseResumeBtn").textContent = "Pause";

  renderTimerTick();
  tick();
}

function tick() {
  clearInterval(session.timerId);
  session.timerId = setInterval(() => {
    if (session.paused) return;
    session.secondsLeft -= 1;
    if (session.secondsLeft <= 0) {
      completeCurrentPhase();
    } else {
      renderTimerTick();
    }
  }, 1000);
}

function completeCurrentPhase() {
  const phase = session.phases[session.phaseIndex];

  if (phase.type === "work") {
    session.workPhasesCompleted += 1;
    state.stats.focusSessionsToday += 1;
    persistStats();
    renderSessionsPill();

    const task = state.tasks.find((t) => t.id === session.linkedTaskId);
    if (task) {
      task.status = "in-progress";
      persistTasks();
      showToast(`Nice work — "${task.title}" is now in progress`);
    } else {
      showToast("Focus session complete");
    }

    // Auto-progress: enough work phases done -> mark the linked task complete
    if (task && session.workPhasesCompleted >= session.sessionsTarget) {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      state.stats.completedToday += 1;
      persistStats();
      persistTasks();
      showToast(`🎉 "${task.title}" marked complete!`);
      endSession();
      return;
    }
  } else {
    showToast("Break's over — back to it");
  }

  advancePhase();
}

function advancePhase() {
  session.phaseIndex = (session.phaseIndex + 1) % session.phases.length;
  session.secondsLeft = session.phases[session.phaseIndex].seconds;
  renderTimerTick();
}

function togglePause() {
  session.paused = !session.paused;
  document.getElementById("pauseResumeBtn").textContent = session.paused ? "Resume" : "Pause";
}

function skipPhase() {
  clearInterval(session.timerId);
  completeCurrentPhase();
  tick();
}

function endSession() {
  clearInterval(session.timerId);
  session.active = false;
  document.getElementById("focusTimerPanel").hidden = true;
  document.getElementById("focusSetupPanel").hidden = false;
  populateTaskSelect();
}

/* ---------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------- */
function initFocusEvents() {
  document.getElementById("startFocusBtn").addEventListener("click", startSession);
  document.getElementById("pauseResumeBtn").addEventListener("click", togglePause);
  document.getElementById("skipPhaseBtn").addEventListener("click", skipPhase);
  document.getElementById("endSessionBtn").addEventListener("click", () => {
    showToast("Session ended");
    endSession();
  });
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  initSidebarToggle();
  initFocusEvents();

  populateTaskSelect();
  renderSessionsPill();
});