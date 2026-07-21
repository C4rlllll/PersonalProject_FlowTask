function renderTopbarDate() {
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  document.getElementById("topbarDate").textContent = dateStr;
}

function startOfWeek(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function taskCardHtml(task) {
  return `
    <div class="task-main">
      <span class="task-title">${escapeHtml(task.title)}</span>
      <div class="task-meta">
        <span class="badge badge-${task.priority}">${task.priority}</span>
        <span class="badge badge-status-${task.status || "not-started"}">${task.status === "in-progress" ? "In Progress" : "Not Yet Done"}</span>
        <span class="task-time">
          ${task.scheduledDate ? `Do on ${formatDatePretty(task.scheduledDate)}` : "No date set"}
          ${task.dueDate ? ` · Due ${formatDatePretty(task.dueDate)}` : ""}
        </span>
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn-sm edit-task" aria-label="Edit task">✎</button>
      <button class="icon-btn-sm danger delete-task" aria-label="Delete task">🗑</button>
    </div>
  `;
}

function renderWeeklyPlanner() {
  const container = document.getElementById("weeklyPlanner");
  const empty = document.getElementById("plannerEmptyState");
  const pill = document.getElementById("plannerCountPill");
  if (!container) return; // section not present in this HTML — skip safely
  container.innerHTML = "";

  const scheduled = state.tasks.filter((t) => !t.done && t.scheduledDate);
  if (pill) pill.textContent = `${scheduled.length} scheduled`;

  if (scheduled.length === 0) {
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;

    const byWeek = {};
    scheduled.forEach((t) => {
      const key = startOfWeek(t.scheduledDate);
      (byWeek[key] ??= []).push(t);
    });

    Object.keys(byWeek).sort().forEach((weekStart) => {
      const group = document.createElement("div");
      group.className = "week-group";

      const weekEndDate = new Date(weekStart + "T00:00:00");
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const label = `${formatDatePretty(weekStart)} – ${formatDatePretty(weekEndDate.toISOString().slice(0, 10))}`;

      const title = document.createElement("div");
      title.className = "week-group-title";
      title.textContent = `Week of ${label}`;
      group.appendChild(title);

      const list = document.createElement("div");
      list.className = "task-list";

      byWeek[weekStart]
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
        .forEach((task) => {
          const card = document.createElement("div");
          card.className = "task-card";
          card.dataset.id = task.id;
          card.innerHTML = taskCardHtml(task);
          list.appendChild(card);
        });

      group.appendChild(list);
      container.appendChild(group);
    });
  }
}

function renderUnscheduled() {
  const list = document.getElementById("unscheduledList");
  const empty = document.getElementById("unscheduledEmptyState");
  if (!list) return; // section not present in this HTML — skip safely
  list.innerHTML = "";

  const unscheduled = state.tasks.filter((t) => !t.done && !t.scheduledDate);

  if (unscheduled.length === 0) {
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;
    unscheduled.forEach((task) => {
      const card = document.createElement("div");
      card.className = "task-card";
      card.dataset.id = task.id;
      card.innerHTML = taskCardHtml(task);
      list.appendChild(card);
    });
  }
}

function renderPlannerAll() {
  renderTopbarDate();
  renderWeeklyPlanner();
  renderUnscheduled();
}

/* ---------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------- */
function initPlannerTaskEvents() {
  const form = document.getElementById("taskForm");
  const fab = document.getElementById("fabAddTask");

  fab.addEventListener("click", () => {
    form.reset();
    document.getElementById("taskId").value = "";
    document.getElementById("taskScheduledDate").value = todayISO();
    document.getElementById("taskModalTitle").textContent = "Add Task";
    openModal("taskModalOverlay");
    document.getElementById("taskTitle").focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("taskId").value;
    const title = clampText(document.getElementById("taskTitle").value, 150);
    const priority = document.getElementById("taskPriority").value;
    const status = document.getElementById("taskStatus").value;
    const time = document.getElementById("taskTime").value;
    const dueDate = document.getElementById("taskDueDate").value;
    const scheduledDate = document.getElementById("taskScheduledDate").value;
    if (!title) return;

    if (id) {
      const task = state.tasks.find((t) => t.id === id);
      if (task) Object.assign(task, { title, priority, time, status, dueDate, scheduledDate });
      showToast("Task updated");
    } else {
      state.tasks.push({ id: uid("t"), title, priority, time, status, dueDate, scheduledDate, done: false });
      showToast("Task scheduled");
    }
    persistTasks();
    renderPlannerAll();
    closeModal("taskModalOverlay");
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".task-card");
    if (!card) return;
    const id = card.dataset.id;
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    if (e.target.classList.contains("edit-task")) {
      document.getElementById("taskId").value = task.id;
      document.getElementById("taskTitle").value = task.title;
      document.getElementById("taskPriority").value = task.priority;
      document.getElementById("taskStatus").value = task.status || "not-started";
      document.getElementById("taskTime").value = task.time || "";
      document.getElementById("taskDueDate").value = task.dueDate || "";
      document.getElementById("taskScheduledDate").value = task.scheduledDate || "";
      document.getElementById("taskModalTitle").textContent = "Edit Task";
      openModal("taskModalOverlay");
      return;
    }
    if (e.target.classList.contains("delete-task")) {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      persistTasks();
      renderPlannerAll();
      showToast("Task deleted");
    }
  });
}

function initPlannerNotifications() {
  document.getElementById("notifBtn").addEventListener("click", () => {
    const today = todayISO();
    const dueNow = state.tasks.filter((t) => !t.done && (!t.scheduledDate || t.scheduledDate <= today)).length;
    showToast(dueNow ? `${dueNow} task(s) due on your Dashboard` : "Nothing due yet");
  });
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  initSidebarToggle();
  initModalCloseButtons();
  initPlannerTaskEvents();
  initPlannerNotifications();

  renderPlannerAll();
});