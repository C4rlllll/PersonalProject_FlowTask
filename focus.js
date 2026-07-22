/* =========================================================
   FLOW — focus.js (Focus / Pomodoro page)
   Requires common.js loaded first.
========================================================= */

/* ---------------------------------------------------------
   PRESETS
   Each phase: { type: "work" | "break", label, seconds }
   "work" phases are the ones that count toward auto-progress.
--------------------------------------------------------- */
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

const DEFAULT_TAB_TITLE = document.title;

/* ---------------------------------------------------------
   SESSION STATE (in-memory only — resets on page reload)

   The timer is driven by an absolute end timestamp
   (phaseEndTime) rather than counting down by 1 each tick.
   Browsers throttle setInterval in background tabs, which
   would otherwise make a decrement-based timer drift/lag
   when you switch away. Recomputing "how much time is left"
   from the clock each tick means it's always accurate the
   instant it runs, even if ticks were delayed.
--------------------------------------------------------- */
const session = {
  active: false,
  paused: false,
  presetKey: "classic",
  phases: [],
  phaseIndex: 0,
  secondsLeft: 0,
  phaseEndTime: null, // Date.now()-based timestamp; null while paused
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
   SOUND — phase-end chime via Web Audio API (no audio files
   needed). The AudioContext is created/resumed on the Start
   Session click, which counts as a user gesture and unlocks
   audio for the later automatic chimes that fire from the
   timer instead of a click.
--------------------------------------------------------- */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, freq, startAt, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

// Two-note chime — plays whenever a phase (work or break) ends.
function playPhaseEndChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.32);
    playTone(ctx, 1108, now + 0.16, 0.36);
  } catch (err) {
    console.warn("Could not play sound:", err);
  }
}

// Three-note ascending chime — plays when a whole linked task
// gets auto-completed at the end of a session.
function playCompletionChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playTone(ctx, 660, now, 0.28);
    playTone(ctx, 880, now + 0.14, 0.28);
    playTone(ctx, 1174, now + 0.28, 0.4);
  } catch (err) {
    console.warn("Could not play sound:", err);
  }
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

function updateTabTitle() {
  if (!session.active) {
    document.title = DEFAULT_TAB_TITLE;
    return;
  }
  const phase = session.phases[session.phaseIndex];
  const pausedTag = session.paused ? " (Paused)" : "";
  document.title = `${formatClock(session.secondsLeft)} · ${phase.label}${pausedTag} — Flow`;
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
  updateTabTitle();
}

/* ---------------------------------------------------------
   SESSION CONTROL
--------------------------------------------------------- */
function startPhaseClock() {
  session.phaseEndTime = Date.now() + session.secondsLeft * 1000;
}

function startSession() {
  const presetKey = document.getElementById("focusPreset").value;
  const taskId = document.getElementById("focusTaskSelect").value;
  const target = Math.max(1, Number(document.getElementById("focusSessionsTarget").value) || 1);

  // Unlock audio here, on a real click, so later automatic
  // chimes (triggered by the timer, not a click) aren't blocked
  // by the browser's autoplay policy.
  getAudioContext();

  session.active = true;
  session.paused = false;
  session.presetKey = presetKey;
  session.phases = PRESETS[presetKey];
  session.phaseIndex = 0;
  session.secondsLeft = session.phases[0].seconds;
  session.linkedTaskId = taskId;
  session.workPhasesCompleted = 0;
  session.sessionsTarget = target;
  startPhaseClock();

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
    if (session.paused || session.phaseEndTime === null) return;

    // Recompute remaining time from the clock every tick, instead
    // of decrementing by 1 — stays accurate even if this interval
    // was throttled while the tab was in the background.
    const remainingMs = session.phaseEndTime - Date.now();
    session.secondsLeft = Math.max(0, Math.round(remainingMs / 1000));

    if (session.secondsLeft <= 0) {
      completeCurrentPhase();
    } else {
      renderTimerTick();
    }
  }, 250);
}

function completeCurrentPhase() {
  playPhaseEndChime();
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
      playCompletionChime();
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
  startPhaseClock();
  renderTimerTick();
}

function togglePause() {
  if (session.paused) {
    // Resuming — recompute the end time from the frozen secondsLeft
    // so the paused duration isn't counted against the phase.
    session.paused = false;
    startPhaseClock();
  } else {
    // Pausing — freeze the current remaining time and stop
    // treating phaseEndTime as valid until resumed.
    const remainingMs = session.phaseEndTime - Date.now();
    session.secondsLeft = Math.max(0, Math.round(remainingMs / 1000));
    session.phaseEndTime = null;
    session.paused = true;
  }
  document.getElementById("pauseResumeBtn").textContent = session.paused ? "Resume" : "Pause";
  updateTabTitle();
}

function skipPhase() {
  clearInterval(session.timerId);
  completeCurrentPhase();
  tick();
}

function endSession() {
  clearInterval(session.timerId);
  session.active = false;
  session.paused = false;
  session.phaseEndTime = null;
  document.getElementById("focusTimerPanel").hidden = true;
  document.getElementById("focusSetupPanel").hidden = false;
  updateTabTitle();
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

  // Reflect the correct remaining time immediately when returning
  // to this tab, rather than waiting for the next 250ms tick.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && session.active && !session.paused && session.phaseEndTime !== null) {
      const remainingMs = session.phaseEndTime - Date.now();
      session.secondsLeft = Math.max(0, Math.round(remainingMs / 1000));
      if (session.secondsLeft <= 0) {
        completeCurrentPhase();
      } else {
        renderTimerTick();
      }
    }
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