/* =========================================================
   FLOW — script.js (Dashboard page)
   Requires common.js loaded first (DataStore, state, uid,
   loadState, persist*, formatTime12h, todayISO, escapeHtml,
   showToast, initSidebarToggle, openModal/closeModal, etc.)
========================================================= */

/* ---------------------------------------------------------
   RENDER FUNCTIONS
--------------------------------------------------------- */
function renderGreetingAndDate() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Good Evening";
  if (hour < 12) greeting = "Good Morning";
  else if (hour < 18) greeting = "Good Afternoon";

  document.getElementById("greetingText").textContent = greeting;

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  document.getElementById("topbarDate").textContent = dateStr;
  document.getElementById("progressDateLabel").textContent = dateStr;

  const initial = (state.user.name || "P").charAt(0).toUpperCase();
  document.getElementById("sidebarAvatar").textContent = initial;
  document.getElementById("topbarAvatar").textContent = initial;
  document.getElementById("sidebarUserName").textContent = state.user.name;
}

const DASHBOARD_TASK_LIMIT = 5;

function renderTasks() {
  const list = document.getElementById("taskList");
  const empty = document.getElementById("taskEmptyState");
  const pill = document.getElementById("taskCountPill");

  const today = todayISO();

  // Dashboard only shows tasks whose scheduled date has arrived
  // (or has no schedule set — treated as "do anytime"), capped at 5.
  const due = state.tasks.filter(
    (t) => !t.done && (!t.scheduledDate || t.scheduledDate <= today)
  );
  const sorted = due.slice(0, DASHBOARD_TASK_LIMIT);
  list.innerHTML = "";

  if (sorted.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    sorted.forEach((task) => {
      const card = document.createElement("div");
      card.className = "task-card";
      card.dataset.id = task.id;
      card.innerHTML = `
        <input type="checkbox" class="checkbox" aria-label="Mark task complete" />
        <div class="task-main">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <div class="task-meta">
            <span class="badge badge-${task.priority}">${task.priority}</span>
            ${task.time ? `<span class="task-time">${formatTime12h(task.time)}</span>` : ""}
            <span class="badge badge-status-${task.status || "not-started"}">${task.status === "in-progress" ? "In Progress" : "Not Yet Done"}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn-sm edit-task" aria-label="Edit task">✎</button>
          <button class="icon-btn-sm danger delete-task" aria-label="Delete task">🗑</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  pill.textContent = `${due.length} open`;
}

function renderAgenda() {
  const list = document.getElementById("timelineList");
  const empty = document.getElementById("agendaEmptyState");
  list.innerHTML = "";

  const today = todayISO();
  const sorted = state.agenda
    .filter((item) => item.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (sorted.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    sorted.forEach((item) => {
      const row = document.createElement("div");
      row.className = `timeline-item${item.done ? " done" : ""}`;
      row.dataset.id = item.id;
      row.innerHTML = `
        <input type="checkbox" class="checkbox agenda-checkbox" ${item.done ? "checked" : ""} aria-label="Mark done" />
        <div class="timeline-dot"></div>
        <div class="timeline-body">
          <div class="timeline-text">
            <span class="timeline-time">${formatTime12h(item.time)}</span>
            <span class="timeline-title">${escapeHtml(item.title)}</span>
            ${item.description ? `<span class="timeline-desc">${escapeHtml(item.description)}</span>` : ""}
          </div>
          <div class="timeline-actions">
            <button class="icon-btn-sm edit-agenda" aria-label="Edit agenda item">✎</button>
            <button class="icon-btn-sm danger delete-agenda" aria-label="Delete agenda item">🗑</button>
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  }
}

function renderHabits() {
  const grid = document.getElementById("habitGrid");
  grid.innerHTML = "";

  state.habits.forEach((habit) => {
    const pct = Math.min(100, Math.round((habit.progress / habit.target) * 100));
    const done = habit.progress >= habit.target;

    const card = document.createElement("div");
    card.className = `habit-card${done ? " done" : ""}`;
    card.dataset.id = habit.id;
    card.innerHTML = `
      <div class="habit-burst"></div>
      <div class="habit-top">
        <div class="habit-emoji">${escapeHtml(habit.emoji)}</div>
        <div class="habit-name-wrap">
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          <span class="habit-progress-label">${habit.progress} / ${habit.target}</span>
        </div>
      </div>
      <div class="habit-bar-track">
        <div class="habit-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="habit-bottom">
        <button class="habit-increment" aria-label="Log progress">${done ? "Done" : "+ Log"}</button>
        <button class="icon-btn-sm danger delete-habit" aria-label="Delete habit">🗑</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderProgress() {
  const today = todayISO();
  const dueTasks = state.tasks.filter((t) => !t.scheduledDate || t.scheduledDate <= today);

  const totalTasks = dueTasks.length + state.stats.completedToday;
  const doneTasks = state.stats.completedToday;

  const totalHabits = state.habits.length;
  const doneHabits = state.habits.filter((h) => h.progress >= h.target).length;

  const taskRatio = totalTasks ? doneTasks / totalTasks : 0;
  const habitRatio = totalHabits ? doneHabits / totalHabits : 0;
  const productivity = totalTasks + totalHabits ? Math.round(((taskRatio + habitRatio) / 2) * 100) : 0;

  document.getElementById("tasksCompletedLabel").textContent = `${doneTasks}/${totalTasks}`;
  document.getElementById("habitsCompletedLabel").textContent = `${doneHabits}/${totalHabits}`;
  document.getElementById("productivityLabel").textContent = `${productivity}%`;

  setRing("ringTasks", taskRatio);
  setRing("ringHabits", habitRatio);
  setRing("ringProductivity", productivity / 100);
}

function setRing(id, ratio) {
  const circle = document.getElementById(id);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - Math.max(0, Math.min(1, ratio)) * circumference;
  requestAnimationFrame(() => {
    circle.style.strokeDashoffset = offset;
  });
}

const QUOTES = [
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "James Clear" },
  { text: "The pain of discipline weighs ounces; the pain of regret weighs tons.", author: "Jim Rohn" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
];

function renderMotivation() {
  const random = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById("motivationQuote").textContent = `"${random.text}"`;
  document.getElementById("motivationAuthor").textContent = `— ${random.author}`;
}

function dashboardGoalCardHtml(goal) {
  const { done, total, pct } = goalProgress(goal);
  const cur = currentPhaseIndex(goal);
  const nextPhase = cur === -1 ? null : goal.phases[cur];

  return `
    <div class="goal-card goal-card-compact" data-id="${goal.id}">
      <div class="goal-card-header">
        <div class="goal-card-title-wrap">
          <span class="goal-card-title">${escapeHtml(goal.title)}</span>
          <span class="goal-card-sub">${nextPhase ? `Up next: ${escapeHtml(nextPhase.title)}` : "All phases complete! 🎉"}</span>
        </div>
      </div>
      <div class="habit-bar-track goal-bar-track">
        <div class="habit-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="goal-progress-label">${done} / ${total} phases</span>
      ${nextPhase ? `
        <label class="goal-quick-check">
          <input type="checkbox" class="checkbox dashboard-phase-checkbox" data-phase-index="${cur}" />
          <span>Mark "${escapeHtml(nextPhase.title)}" done</span>
        </label>
      ` : ""}
    </div>
  `;
}

function renderGoalsSummary() {
  const list = document.getElementById("dashboardGoalList");
  const empty = document.getElementById("dashboardGoalsEmptyState");
  if (!list) return;
  list.innerHTML = "";

  if (state.goals.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  state.goals.forEach((goal) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = dashboardGoalCardHtml(goal);
    list.appendChild(wrap.firstElementChild);
  });
}

function initGoalsSummaryEvents() {
  const list = document.getElementById("dashboardGoalList");
  if (!list) return;
  list.addEventListener("click", (e) => {
    if (!e.target.classList.contains("dashboard-phase-checkbox")) return;
    const card = e.target.closest(".goal-card");
    const goalId = card.dataset.id;
    const index = Number(e.target.dataset.phaseIndex);
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal || !canTogglePhase(goal, index)) return;

    goal.phases[index].done = true;
    persistGoals();
    renderGoalsSummary();
    showToast(
      currentPhaseIndex(goal) === -1 ? `🎉 "${goal.title}" complete!` : `Nice — moved to the next phase of "${goal.title}"`
    );
  });
}

function renderAll() {
  renderGreetingAndDate();
  renderTasks();
  renderAgenda();
  renderHabits();
  renderProgress();
  renderGoalsSummary();
}

/* ---------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------- */
function initTaskEvents() {
  const form = document.getElementById("taskForm");
  const list = document.getElementById("taskList");
  const fab = document.getElementById("fabAddTask");

  fab.addEventListener("click", () => {
    form.reset();
    document.getElementById("taskId").value = "";
    document.getElementById("taskModalTitle").textContent = "Add Task";
    openModal("taskModalOverlay");
    document.getElementById("taskTitle").focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("taskId").value;
    const title = document.getElementById("taskTitle").value.trim();
    const priority = document.getElementById("taskPriority").value;
    const status = document.getElementById("taskStatus") ? document.getElementById("taskStatus").value : "not-started";
    const time = document.getElementById("taskTime").value;
    const dueDate = document.getElementById("taskDueDate") ? document.getElementById("taskDueDate").value : "";
    const scheduledDate = document.getElementById("taskScheduledDate") ? document.getElementById("taskScheduledDate").value : "";
    if (!title) return;

    if (id) {
      const task = state.tasks.find((t) => t.id === id);
      if (task) Object.assign(task, { title, priority, time, status, dueDate, scheduledDate });
      showToast("Task updated");
    } else {
      state.tasks.push({ id: uid("t"), title, priority, time, status, dueDate, scheduledDate, done: false });
      showToast("Task added");
    }
    persistTasks();
    renderTasks();
    renderProgress();
    closeModal("taskModalOverlay");
  });

  list.addEventListener("click", (e) => {
    const card = e.target.closest(".task-card");
    if (!card) return;
    const id = card.dataset.id;
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    if (e.target.classList.contains("checkbox")) {
      if (e.target.checked) {
        task.done = true;
        card.classList.add("completed");
        setTimeout(() => {
          state.tasks = state.tasks.filter((t) => t.id !== id);
          state.stats.completedToday += 1;
          persistStats();
          persistTasks();
          renderTasks();
          renderProgress();
          showToast("Task completed!");
        }, 300);
      }
      return;
    }
    if (e.target.classList.contains("edit-task")) {
      document.getElementById("taskId").value = task.id;
      document.getElementById("taskTitle").value = task.title;
      document.getElementById("taskPriority").value = task.priority;
      document.getElementById("taskStatus").value = task.status || "not-started";
      document.getElementById("taskTime").value = task.time || "";
      if (document.getElementById("taskDueDate")) document.getElementById("taskDueDate").value = task.dueDate || "";
      if (document.getElementById("taskScheduledDate")) document.getElementById("taskScheduledDate").value = task.scheduledDate || "";
      document.getElementById("taskModalTitle").textContent = "Edit Task";
      openModal("taskModalOverlay");
      return;
    }
    if (e.target.classList.contains("delete-task")) {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      persistTasks();
      renderTasks();
      renderProgress();
      showToast("Task deleted");
    }
  });
}

function initAgendaEvents() {
  const form = document.getElementById("agendaForm");
  const list = document.getElementById("timelineList");

  document.getElementById("addAgendaBtn").addEventListener("click", () => {
    form.reset();
    document.getElementById("agendaId").value = "";
    document.getElementById("agendaDate").value = todayISO();
    document.getElementById("agendaModalTitle").textContent = "Add Agenda Item";
    openModal("agendaModalOverlay");
    document.getElementById("agendaTitle").focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("agendaId").value;
    const title = document.getElementById("agendaTitle").value.trim();
    const description = document.getElementById("agendaDescription").value.trim();
    const date = document.getElementById("agendaDate").value;
    const time = document.getElementById("agendaTime").value;
    if (!title || !time || !date) return;

    if (id) {
      const item = state.agenda.find((a) => a.id === id);
      if (item) Object.assign(item, { title, description, date, time });
      showToast("Agenda updated");
    } else {
      state.agenda.push({ id: uid("a"), title, description, date, time, done: false });
      showToast("Agenda item added");
    }
    persistAgenda();
    renderAgenda();
    closeModal("agendaModalOverlay");
  });

  list.addEventListener("click", (e) => {
    const row = e.target.closest(".timeline-item");
    if (!row) return;
    const id = row.dataset.id;
    const item = state.agenda.find((a) => a.id === id);
    if (!item) return;

    if (e.target.classList.contains("agenda-checkbox")) {
      item.done = e.target.checked;
      persistAgenda();
      renderAgenda();
      return;
    }
    if (e.target.classList.contains("edit-agenda")) {
      document.getElementById("agendaId").value = item.id;
      document.getElementById("agendaTitle").value = item.title;
      document.getElementById("agendaDescription").value = item.description || "";
      document.getElementById("agendaDate").value = item.date || "";
      document.getElementById("agendaTime").value = item.time;
      document.getElementById("agendaModalTitle").textContent = "Edit Agenda Item";
      openModal("agendaModalOverlay");
      return;
    }
    if (e.target.classList.contains("delete-agenda")) {
      state.agenda = state.agenda.filter((a) => a.id !== id);
      persistAgenda();
      renderAgenda();
      showToast("Agenda item deleted");
    }
  });
}

function initHabitEvents() {
  const form = document.getElementById("habitForm");
  const grid = document.getElementById("habitGrid");

  document.getElementById("addHabitBtn").addEventListener("click", () => {
    form.reset();
    document.getElementById("habitEmoji").value = "⭐";
    document.getElementById("habitTarget").value = 4;
    openModal("habitModalOverlay");
    document.getElementById("habitName").focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const emoji = document.getElementById("habitEmoji").value.trim() || "⭐";
    const name = document.getElementById("habitName").value.trim();
    const target = Math.max(1, Number(document.getElementById("habitTarget").value) || 1);
    if (!name) return;

    state.habits.push({ id: uid("h"), emoji, name, target, progress: 0 });
    persistHabits();
    renderHabits();
    renderProgress();
    closeModal("habitModalOverlay");
    showToast("Habit added");
  });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".habit-card");
    if (!card) return;
    const id = card.dataset.id;
    const habit = state.habits.find((h) => h.id === id);
    if (!habit) return;

    if (e.target.classList.contains("delete-habit")) {
      state.habits = state.habits.filter((h) => h.id !== id);
      persistHabits();
      renderHabits();
      renderProgress();
      showToast("Habit deleted");
      return;
    }

    if (e.target.classList.contains("habit-increment")) {
      if (habit.progress >= habit.target) {
        habit.progress = 0;
      } else {
        habit.progress += 1;
      }
      const willBeDone = habit.progress >= habit.target;
      persistHabits();
      renderHabits();
      renderProgress();

      if (willBeDone) {
        const freshCard = grid.querySelector(`.habit-card[data-id="${id}"]`);
        if (freshCard) {
          freshCard.classList.add("burst");
          setTimeout(() => freshCard.classList.remove("burst"), 650);
        }
        showToast(`${habit.name} complete! 🎉`);
      }
    }
  });
}

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    document.querySelectorAll("#taskList .task-card").forEach((card) => {
      const text = card.querySelector(".task-title").textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? "" : "none";
    });
    document.querySelectorAll("#timelineList .timeline-item").forEach((row) => {
      const text = row.querySelector(".timeline-title").textContent.toLowerCase();
      row.style.display = !q || text.includes(q) ? "" : "none";
    });
    document.querySelectorAll("#habitGrid .habit-card").forEach((card) => {
      const text = card.querySelector(".habit-name").textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? "" : "none";
    });
  });
}

function initNotifications() {
  const btn = document.getElementById("notifBtn");
  const dot = document.getElementById("notifDot");

  const dueSoon = state.tasks.some((t) => !t.done);
  dot.hidden = !dueSoon;

  btn.addEventListener("click", () => {
    dot.hidden = true;
    const openCount = state.tasks.filter((t) => !t.done).length;
    showToast(openCount ? `You have ${openCount} open task(s) today` : "You're all caught up");
  });
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderAll();
  renderMotivation();

  initSidebarToggle();
  initModalCloseButtons();
  initTaskEvents();
  initAgendaEvents();
  initHabitEvents();
  initSearch();
  initNotifications();
  initGoalsSummaryEvents();
});