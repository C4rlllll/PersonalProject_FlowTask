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

function agendaRowHtml(item) {
  return `
    <input type="checkbox" class="checkbox agenda-checkbox" ${item.done ? "checked" : ""} aria-label="Mark done" />
    <div class="timeline-dot"></div>
    <div class="timeline-body">
      <div class="timeline-text">
        <span class="timeline-time">${formatTime12h(item.time)}${item.date ? ` · ${formatDatePretty(item.date)}` : ""}</span>
        <span class="timeline-title">${escapeHtml(item.title)}</span>
        ${item.description ? `<span class="timeline-desc">${escapeHtml(item.description)}</span>` : ""}
      </div>
      <div class="timeline-actions">
        <button class="icon-btn-sm edit-agenda" aria-label="Edit agenda item">✎</button>
        <button class="icon-btn-sm danger delete-agenda" aria-label="Delete agenda item">🗑</button>
      </div>
    </div>
  `;
}

function renderTodayAgenda() {
  const list = document.getElementById("todayAgendaList");
  const empty = document.getElementById("todayEmptyState");
  const pill = document.getElementById("todayCountPill");
  const today = todayISO();

  const items = state.agenda
    .filter((a) => a.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));

  pill.textContent = `${items.length} items`;
  list.innerHTML = "";

  if (items.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = `timeline-item${item.done ? " done" : ""}`;
      row.dataset.id = item.id;
      row.innerHTML = agendaRowHtml(item);
      list.appendChild(row);
    });
  }
}

function renderUpcomingAgenda() {
  const container = document.getElementById("weeklyAgendaPlanner");
  const empty = document.getElementById("upcomingEmptyState");
  const pill = document.getElementById("upcomingCountPill");
  const today = todayISO();

  const upcoming = state.agenda.filter((a) => a.date && a.date > today);
  pill.textContent = `${upcoming.length} scheduled`;
  container.innerHTML = "";

  if (upcoming.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const byWeek = {};
  upcoming.forEach((item) => {
    const key = startOfWeek(item.date);
    (byWeek[key] ??= []).push(item);
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
    list.className = "timeline";

    byWeek[weekStart]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .forEach((item) => {
        const row = document.createElement("div");
        row.className = `timeline-item${item.done ? " done" : ""}`;
        row.dataset.id = item.id;
        row.innerHTML = agendaRowHtml(item);
        list.appendChild(row);
      });

    group.appendChild(list);
    container.appendChild(group);
  });
}

function renderAgendaAll() {
  renderTopbarDate();
  renderTodayAgenda();
  renderUpcomingAgenda();
}

/* ---------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------- */
function initAgendaPlannerEvents() {
  const form = document.getElementById("agendaForm");
  const fab = document.getElementById("fabAddAgenda");

  fab.addEventListener("click", () => {
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
    const title = clampText(document.getElementById("agendaTitle").value, 150);
    const description = clampText(document.getElementById("agendaDescription").value, 500);
    const date = document.getElementById("agendaDate").value;
    const time = document.getElementById("agendaTime").value;
    if (!title || !date || !time) return;

    if (id) {
      const item = state.agenda.find((a) => a.id === id);
      if (item) Object.assign(item, { title, description, date, time });
      showToast("Agenda updated");
    } else {
      state.agenda.push({ id: uid("a"), title, description, date, time, done: false });
      showToast("Agenda item added");
    }
    persistAgenda();
    renderAgendaAll();
    closeModal("agendaModalOverlay");
  });

  document.addEventListener("click", (e) => {
    const row = e.target.closest(".timeline-item");
    if (!row) return;
    const id = row.dataset.id;
    const item = state.agenda.find((a) => a.id === id);
    if (!item) return;

    if (e.target.classList.contains("agenda-checkbox")) {
      item.done = e.target.checked;
      persistAgenda();
      renderAgendaAll();
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
      renderAgendaAll();
      showToast("Agenda item deleted");
    }
  });
}

function initAgendaNotifications() {
  document.getElementById("notifBtn").addEventListener("click", () => {
    const today = todayISO();
    const count = state.agenda.filter((a) => a.date === today).length;
    showToast(count ? `${count} item(s) on today's agenda` : "Nothing scheduled today");
  });
}

/* ---------------------------------------------------------
   INIT — listeners attach before rendering so a render
   error can never block Add Event from working.
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  initSidebarToggle();
  initModalCloseButtons();
  initAgendaPlannerEvents();
  initAgendaNotifications();

  renderAgendaAll();
});