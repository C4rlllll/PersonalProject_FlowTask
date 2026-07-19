/* =========================================================
   FLOW — goals.js (Goals page)
   Requires common.js loaded first.
========================================================= */

function phaseStepperHtml(goal) {
  const cur = currentPhaseIndex(goal);
  return goal.phases
    .map((phase, i) => {
      const locked = !canTogglePhase(goal, i) && !phase.done;
      const isCurrent = i === cur;
      let stateClass = "locked";
      if (phase.done) stateClass = "done";
      else if (isCurrent) stateClass = "current";

      return `
        <div class="phase-row phase-${stateClass}" data-index="${i}">
          <input type="checkbox" class="checkbox phase-checkbox" data-index="${i}"
                 ${phase.done ? "checked" : ""} ${locked && !phase.done ? "disabled" : ""}
                 aria-label="Mark phase done" />
          <span class="phase-title">${escapeHtml(phase.title)}</span>
          ${stateClass === "locked" ? '<span class="phase-lock">🔒</span>' : ""}
        </div>
      `;
    })
    .join("");
}

function goalCardHtml(goal) {
  const { done, total, pct } = goalProgress(goal);
  const cur = currentPhaseIndex(goal);
  const currentLabel = cur === -1 ? "All phases complete! 🎉" : `Up next: ${escapeHtml(goal.phases[cur].title)}`;

  return `
    <div class="goal-card" data-id="${goal.id}">
      <div class="goal-card-header">
        <div class="goal-card-title-wrap">
          <span class="goal-card-title">${escapeHtml(goal.title)}</span>
          <span class="goal-card-sub">${currentLabel}</span>
        </div>
        <div class="goal-card-actions">
          <button class="icon-btn-sm add-phase-btn" aria-label="Add phase">➕</button>
          <button class="icon-btn-sm danger delete-goal-btn" aria-label="Delete goal">🗑</button>
        </div>
      </div>
      <div class="habit-bar-track goal-bar-track">
        <div class="habit-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="goal-progress-label">${done} / ${total} phases</span>
      <div class="phase-stepper">${phaseStepperHtml(goal)}</div>
    </div>
  `;
}

function renderGoals() {
  const list = document.getElementById("goalList");
  const empty = document.getElementById("goalsEmptyState");
  const pill = document.getElementById("goalsCountPill");
  pill.textContent = `${state.goals.length} goals`;

  list.innerHTML = "";
  if (state.goals.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  state.goals.forEach((goal) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = goalCardHtml(goal);
    list.appendChild(wrap.firstElementChild);
  });
}

/* ---------------------------------------------------------
   ADD GOAL MODAL — dynamic phase input rows
--------------------------------------------------------- */
function addPhaseInputRow(value = "") {
  const container = document.getElementById("phaseInputList");
  const row = document.createElement("div");
  row.className = "phase-input-row";
  row.innerHTML = `
    <input type="text" class="phase-input" placeholder="Phase title" value="${escapeHtml(value)}" />
    <button type="button" class="icon-btn-sm danger remove-phase-input" aria-label="Remove phase">🗑</button>
  `;
  container.appendChild(row);
}

function resetPhaseInputs() {
  document.getElementById("phaseInputList").innerHTML = "";
  addPhaseInputRow();
  addPhaseInputRow();
}

function initGoalFormEvents() {
  const form = document.getElementById("goalForm");
  const fab = document.getElementById("fabAddGoal");

  fab.addEventListener("click", () => {
    form.reset();
    resetPhaseInputs();
    document.getElementById("goalModalTitle").textContent = "Add Goal";
    openModal("goalModalOverlay");
    document.getElementById("goalTitle").focus();
  });

  document.getElementById("addPhaseInputBtn").addEventListener("click", () => addPhaseInputRow());

  document.getElementById("phaseInputList").addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-phase-input")) {
      const rows = document.querySelectorAll(".phase-input-row");
      if (rows.length <= 1) return; // always keep at least one row
      e.target.closest(".phase-input-row").remove();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("goalTitle").value.trim();
    const phaseTitles = Array.from(document.querySelectorAll(".phase-input"))
      .map((input) => input.value.trim())
      .filter(Boolean);

    if (!title || phaseTitles.length === 0) {
      showToast("Add a title and at least one phase");
      return;
    }

    const goal = {
      id: uid("g"),
      title,
      phases: phaseTitles.map((t, i) => ({ id: uid(`g_p${i}`), title: t, done: false })),
    };
    state.goals.push(goal);
    persistGoals();
    renderGoals();
    closeModal("goalModalOverlay");
    showToast("Goal added");
  });
}

/* ---------------------------------------------------------
   ADD PHASE TO EXISTING GOAL
--------------------------------------------------------- */
function initAddPhaseEvents() {
  const form = document.getElementById("addPhaseForm");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const goalId = document.getElementById("addPhaseGoalId").value;
    const title = document.getElementById("newPhaseTitle").value.trim();
    if (!title) return;

    const goal = state.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.phases.push({ id: uid("gp"), title, done: false });
      persistGoals();
      renderGoals();
      showToast("Phase added");
    }
    closeModal("addPhaseModalOverlay");
  });
}

/* ---------------------------------------------------------
   GOAL LIST INTERACTIONS — toggle phase, add phase, delete goal
--------------------------------------------------------- */
function initGoalListEvents() {
  document.getElementById("goalList").addEventListener("click", (e) => {
    const card = e.target.closest(".goal-card");
    if (!card) return;
    const goalId = card.dataset.id;
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    if (e.target.classList.contains("phase-checkbox")) {
      const index = Number(e.target.dataset.index);
      if (!canTogglePhase(goal, index)) {
        e.target.checked = goal.phases[index].done; // snap back, ignore illegal toggle
        showToast("Complete phases in order first");
        return;
      }
      goal.phases[index].done = !goal.phases[index].done;
      persistGoals();
      renderGoals();
      if (goal.phases[index].done && currentPhaseIndex(goal) === -1) {
        showToast(`🎉 "${goal.title}" complete!`);
      }
      return;
    }

    if (e.target.classList.contains("add-phase-btn")) {
      document.getElementById("addPhaseGoalId").value = goal.id;
      document.getElementById("newPhaseTitle").value = "";
      openModal("addPhaseModalOverlay");
      return;
    }

    if (e.target.classList.contains("delete-goal-btn")) {
      state.goals = state.goals.filter((g) => g.id !== goalId);
      persistGoals();
      renderGoals();
      showToast("Goal deleted");
    }
  });
}

/* ---------------------------------------------------------
   INIT — listeners before rendering, same defensive pattern
   used on the other planner pages.
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  initSidebarToggle();
  initModalCloseButtons();
  initGoalFormEvents();
  initAddPhaseEvents();
  initGoalListEvents();

  renderGoals();
});