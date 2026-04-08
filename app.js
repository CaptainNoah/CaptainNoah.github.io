const STORAGE_KEY = "noah-task-board-v1";
const UI_STATE_KEY = "noah-task-board-ui-v1";
const SORT_OPTIONS = new Set(["manual", "priority", "due-soonest", "due-latest", "newest"]);
const THEMES = new Set(["terracotta", "forest", "midnight", "blueprint"]);
const DENSITY_OPTIONS = new Set(["comfortable", "compact"]);
const CORNER_OPTIONS = new Set(["soft", "sharp"]);
const PRIORITY_VALUE = {
  high: 0,
  medium: 1,
  low: 2
};
const DEFAULT_RESET_TIME = "06:00";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const taskForm = document.querySelector("#task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskRecurringInput = document.querySelector("#task-recurring");
const taskNotesInput = document.querySelector("#task-notes");
const taskDueDateInput = document.querySelector("#task-due-date");
const taskPriorityInput = document.querySelector("#task-priority");
const dueDateField = document.querySelector("#due-date-field");
const recurringFields = document.querySelector("#recurring-fields");
const repeatModeSelect = document.querySelector("#task-repeat-mode");
const resetHourSelect = document.querySelector("#task-reset-hour");
const resetMinuteSelect = document.querySelector("#task-reset-minute");
const weekdayFieldset = document.querySelector("#weekday-fieldset");
const weekdayInputs = document.querySelectorAll('input[name="repeat-day"]');
const taskList = document.querySelector("#task-list");
const taskTemplate = document.querySelector("#task-template");
const filterButtons = document.querySelectorAll(".filter-button");
const settingsButton = document.querySelector("#settings-button");
const settingsDialog = document.querySelector("#settings-dialog");
const closeSettingsButton = document.querySelector("#close-settings");
const themeButtons = document.querySelectorAll("[data-theme]");
const densityButtons = document.querySelectorAll("[data-density]");
const cornerButtons = document.querySelectorAll("[data-corners]");
const resetAppearanceButton = document.querySelector("#reset-appearance");
const confirmDialog = document.querySelector("#confirm-dialog");
const confirmMessage = document.querySelector("#confirm-message");
const cancelDeleteButton = document.querySelector("#cancel-delete");
const confirmDeleteButton = document.querySelector("#confirm-delete");
const sortSelect = document.querySelector("#sort-select");
const searchInput = document.querySelector("#search-input");
const organizeHint = document.querySelector("#organize-hint");
const formMode = document.querySelector("#form-mode");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const clearCompletedButton = document.querySelector("#clear-completed");
const taskCount = document.querySelector("#task-count");
const openCount = document.querySelector("#open-count");
const doneCount = document.querySelector("#done-count");
const footerSummary = document.querySelector("#footer-summary");
const statusMessage = document.querySelector("#status-message");

let tasks = loadTasks();
let uiState = loadUiState();
let currentFilter = "all";
let currentSort = normalizeSortMode(uiState.sort);
let searchQuery = "";
let editingTaskId = null;
let draggedTaskId = null;
let pendingDeleteTaskId = null;

sortSelect.value = currentSort;
populateTimeOptions();
applyAppearanceSettings();
render();
syncFormMode();
syncRecurringForm();
syncAppearanceControls();

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskTitleInput.value.trim();
  const isRecurring = taskRecurringInput.checked;
  const notes = taskNotesInput.value.trim();
  const dueDate = isRecurring ? "" : taskDueDateInput.value;
  const priority = normalizePriority(taskPriorityInput.value);
  const recurrence = isRecurring ? buildRecurrenceInput() : null;

  if (!title) {
    taskTitleInput.focus();
    return;
  }

  if (isRecurring && !recurrence) {
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) => {
      if (task.id === editingTaskId) {
        return {
          ...task,
          title,
          notes,
          dueDate,
          priority,
          recurring: isRecurring,
          recurrence: isRecurring
            ? {
                ...recurrence,
                lastCompletedCycleKey: task.recurring ? task.recurrence.lastCompletedCycleKey : ""
              }
            : null,
          completed: isRecurring ? false : task.completed
        };
      }

      return task;
    });
  } else {
    tasks.unshift({
      id: createId(),
      title,
      notes,
      dueDate,
      priority,
      recurring: isRecurring,
      recurrence,
      completed: false,
      createdAt: new Date().toISOString()
    });
  }

  persistTasks();
  resetForm();
  render();
});

taskRecurringInput.addEventListener("change", () => {
  syncRecurringForm();
});

repeatModeSelect.addEventListener("change", () => {
  syncRecurringForm();
});

settingsButton.addEventListener("click", () => {
  openSettingsDialog();
});

closeSettingsButton.addEventListener("click", () => {
  settingsDialog.close();
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    uiState.theme = normalizeTheme(button.dataset.theme);
    persistUiState();
    applyAppearanceSettings();
    syncAppearanceControls();
  });
});

densityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    uiState.density = normalizeDensity(button.dataset.density);
    persistUiState();
    applyAppearanceSettings();
    syncAppearanceControls();
  });
});

cornerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    uiState.corners = normalizeCorners(button.dataset.corners);
    persistUiState();
    applyAppearanceSettings();
    syncAppearanceControls();
  });
});

resetAppearanceButton.addEventListener("click", () => {
  uiState.theme = "terracotta";
  uiState.density = "comfortable";
  uiState.corners = "soft";
  persistUiState();
  applyAppearanceSettings();
  syncAppearanceControls();
});

cancelDeleteButton.addEventListener("click", () => {
  pendingDeleteTaskId = null;
  confirmDialog.close();
});

confirmDeleteButton.addEventListener("click", () => {
  if (!pendingDeleteTaskId) {
    confirmDialog.close();
    return;
  }

  tasks = tasks.filter((item) => item.id !== pendingDeleteTaskId);
  pendingDeleteTaskId = null;
  persistTasks();
  confirmDialog.close();
  render();
});

confirmDialog.addEventListener("close", () => {
  pendingDeleteTaskId = null;
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    clearDragClasses();
    render();
  });
});

sortSelect.addEventListener("change", (event) => {
  currentSort = normalizeSortMode(event.target.value);
  uiState.sort = currentSort;
  persistUiState();
  clearDragClasses();
  render();
});

searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value.trim().toLowerCase();
  clearDragClasses();
  render();
});

clearCompletedButton.addEventListener("click", () => {
  const completedTasks = tasks.filter((task) => !task.recurring && task.completed).length;

  if (completedTasks === 0) {
    return;
  }

  tasks = tasks.filter((task) => task.recurring || !task.completed);
  persistTasks();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

function render() {
  syncEditingTaskState();
  sortSelect.value = currentSort;
  const visibleTasks = getVisibleTasks();
  taskList.innerHTML = "";

  if (visibleTasks.length === 0) {
    taskList.append(createEmptyState());
  } else {
    visibleTasks.forEach((task) => taskList.append(createTaskElement(task)));
  }

  updateSummary(visibleTasks);
  updateOrganizeHint();
}

function getVisibleTasks() {
  const visibleTasks = tasks
    .filter((task) => {
      if (currentFilter === "all") {
        return !task.recurring && !task.completed;
      }

      if (currentFilter === "recurring") {
        return task.recurring;
      }

      if (currentFilter === "completed") {
        return !task.recurring && task.completed;
      }

      return false;
    })
    .filter((task) => {
      if (!searchQuery) {
        return true;
      }

      const haystack = `${task.title} ${task.notes}`.toLowerCase();
      return haystack.includes(searchQuery);
    });

  if (currentSort === "manual") {
    return visibleTasks;
  }

  return visibleTasks.sort((a, b) => compareTasks(a, b, currentSort));
}

function compareTasks(a, b, sortMode) {
  if (currentFilter === "recurring") {
    const recurringCompletionDiff = Number(isTaskCompleteNow(a)) - Number(isTaskCompleteNow(b));

    if (recurringCompletionDiff !== 0) {
      return recurringCompletionDiff;
    }
  }

  if (sortMode === "priority") {
    return compareByPriority(a, b);
  }

  if (sortMode === "due-soonest") {
    return compareByDueDate(a, b, "soonest");
  }

  if (sortMode === "due-latest") {
    return compareByDueDate(a, b, "latest");
  }

  return b.createdAt.localeCompare(a.createdAt);
}

function compareByPriority(a, b) {
  const priorityDiff = PRIORITY_VALUE[a.priority] - PRIORITY_VALUE[b.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return compareByDueDate(a, b, "soonest");
}

function compareByDueDate(a, b, direction) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return direction === "soonest"
      ? a.dueDate.localeCompare(b.dueDate)
      : b.dueDate.localeCompare(a.dueDate);
  }

  if (a.dueDate && !b.dueDate) {
    return -1;
  }

  if (!a.dueDate && b.dueDate) {
    return 1;
  }

  const priorityDiff = PRIORITY_VALUE[a.priority] - PRIORITY_VALUE[b.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return b.createdAt.localeCompare(a.createdAt);
}

function createTaskElement(task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const dragHandle = fragment.querySelector(".drag-handle");
  const toggle = fragment.querySelector(".task-toggle");
  const title = fragment.querySelector(".task-title");
  const notes = fragment.querySelector(".task-notes");
  const priorityPill = fragment.querySelector(".priority-pill");
  const duePill = fragment.querySelector(".due-pill");
  const schedulePill = fragment.querySelector(".schedule-pill");
  const moveUpButton = fragment.querySelector(".task-move-up");
  const moveDownButton = fragment.querySelector(".task-move-down");
  const editButton = fragment.querySelector(".task-edit");
  const deleteButton = fragment.querySelector(".task-delete");
  const manualIndex = tasks.findIndex((item) => item.id === task.id);
  const manualReorderEnabled = canManualReorder();
  const isComplete = isTaskCompleteNow(task);

  card.dataset.id = task.id;
  card.classList.toggle("is-complete", isComplete);
  toggle.checked = isComplete;
  title.textContent = task.title;
  dragHandle.disabled = !manualReorderEnabled;
  dragHandle.draggable = manualReorderEnabled;
  dragHandle.setAttribute("aria-label", `Drag ${task.title} to reorder`);
  dragHandle.title = manualReorderEnabled
    ? "Drag to reorder"
    : "Switch to Manual order with All tasks visible to reorder";
  moveUpButton.disabled = !manualReorderEnabled || manualIndex === 0;
  moveDownButton.disabled = !manualReorderEnabled || manualIndex === tasks.length - 1;

  if (task.notes) {
    notes.textContent = task.notes;
    notes.hidden = false;
  } else {
    notes.hidden = true;
  }

  priorityPill.textContent = formatPriority(task.priority);
  priorityPill.classList.add(task.priority);

  if (task.dueDate) {
    duePill.textContent = formatDueDate(task.dueDate);
    duePill.hidden = false;
  } else {
    duePill.hidden = true;
  }

  if (task.recurring) {
    schedulePill.textContent = formatRecurringSchedule(task);
    schedulePill.hidden = false;
    duePill.hidden = true;
  } else {
    schedulePill.hidden = true;
  }

  toggle.addEventListener("change", () => {
    tasks = tasks.map((item) => {
      if (item.id === task.id) {
        return item.recurring
          ? setRecurringTaskCompletion(item, toggle.checked)
          : { ...item, completed: toggle.checked };
      }

      return item;
    });
    persistTasks();
    render();
  });

  dragHandle.addEventListener("dragstart", (event) => {
    if (!manualReorderEnabled) {
      event.preventDefault();
      return;
    }

    draggedTaskId = task.id;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  });

  dragHandle.addEventListener("dragend", () => {
    draggedTaskId = null;
    clearDragClasses();
  });

  card.addEventListener("dragover", (event) => {
    if (!manualReorderEnabled || !draggedTaskId || draggedTaskId === task.id) {
      return;
    }

    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIndicator(card, position);
  });

  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) {
      card.classList.remove("is-drop-before", "is-drop-after");
    }
  });

  card.addEventListener("drop", (event) => {
    if (!manualReorderEnabled || !draggedTaskId || draggedTaskId === task.id) {
      return;
    }

    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    moveTaskToPosition(draggedTaskId, task.id, position);
  });

  moveUpButton.addEventListener("click", () => {
    moveTaskByOffset(task.id, -1);
  });

  moveDownButton.addEventListener("click", () => {
    moveTaskByOffset(task.id, 1);
  });

  editButton.addEventListener("click", () => {
    startEditing(task);
  });

  deleteButton.addEventListener("click", () => {
    openDeleteDialog(task);
  });

  return fragment;
}

function updateSummary(visibleTasks) {
  const completed = tasks.filter((task) => isTaskCompleteNow(task)).length;
  const completedOneOffTasks = tasks.filter((task) => !task.recurring && task.completed).length;
  const open = tasks.length - completed;
  const overdue = tasks.filter((task) => !task.recurring && !task.completed && isOverdue(task.dueDate)).length;

  taskCount.textContent = String(tasks.length);
  openCount.textContent = String(open);
  doneCount.textContent = String(completed);
  footerSummary.textContent = `${visibleTasks.length} task${visibleTasks.length === 1 ? "" : "s"} shown`;
  clearCompletedButton.disabled = currentFilter !== "completed" || completedOneOffTasks === 0;

  if (tasks.length === 0) {
    statusMessage.textContent = "Nothing on the board yet. Add your first task below.";
    return;
  }

  if (overdue > 0) {
    statusMessage.textContent = `${overdue} overdue task${overdue === 1 ? "" : "s"} need attention.`;
    return;
  }

  if (open === 0) {
    statusMessage.textContent = "Everything is complete. Nice work.";
    return;
  }

  statusMessage.textContent = `${open} open task${open === 1 ? "" : "s"} in progress.`;
}

function createEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const message = document.createElement("p");
  message.textContent = searchQuery
    ? "No tasks match your search yet. Try a different word or clear the search."
    : currentFilter === "recurring"
      ? "Recurring routines will show up here once you add one."
    : currentFilter === "completed"
      ? "Completed tasks will show up here once you start checking things off."
      : "Your list is clear right now. Add a task on the left to get started.";

  empty.append(message);
  return empty;
}

function loadTasks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((task, index) => normalizeTask(task, index)) : [];
  } catch {
    return [];
  }
}

function persistTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadUiState() {
  try {
    const raw = window.localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistUiState() {
  window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
}

function normalizeTask(task, index) {
  const recurring = Boolean(task?.recurring);

  return {
    id: typeof task?.id === "string" && task.id ? task.id : createId(),
    title: typeof task?.title === "string" ? task.title : `Task ${index + 1}`,
    notes: typeof task?.notes === "string" ? task.notes : "",
    dueDate: recurring ? "" : typeof task?.dueDate === "string" ? task.dueDate : "",
    priority: normalizePriority(task?.priority),
    recurring,
    recurrence: recurring ? normalizeRecurrence(task?.recurrence) : null,
    completed: Boolean(task?.completed),
    createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString()
  };
}

function normalizePriority(priority) {
  return priority === "high" || priority === "low" ? priority : "medium";
}

function normalizeRecurrence(recurrence) {
  const mode = recurrence?.mode === "weekly" ? "weekly" : "daily";
  const days = Array.isArray(recurrence?.days)
    ? recurrence.days
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];

  return {
    mode,
    days: mode === "weekly" && days.length > 0 ? [...new Set(days)] : [new Date().getDay()],
    resetTime: isValidTime(recurrence?.resetTime) ? recurrence.resetTime : DEFAULT_RESET_TIME,
    lastCompletedCycleKey: typeof recurrence?.lastCompletedCycleKey === "string"
      ? recurrence.lastCompletedCycleKey
      : ""
  };
}

function normalizeSortMode(sortMode) {
  return SORT_OPTIONS.has(sortMode) ? sortMode : "manual";
}

function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : "terracotta";
}

function normalizeDensity(density) {
  return DENSITY_OPTIONS.has(density) ? density : "comfortable";
}

function normalizeCorners(corners) {
  return CORNER_OPTIONS.has(corners) ? corners : "soft";
}

function applyAppearanceSettings() {
  const theme = normalizeTheme(uiState.theme);
  const density = normalizeDensity(uiState.density);
  const corners = normalizeCorners(uiState.corners);

  uiState.theme = theme;
  uiState.density = density;
  uiState.corners = corners;

  document.body.dataset.theme = theme;
  document.body.dataset.density = density;
  document.body.dataset.corners = corners;
}

function syncAppearanceControls() {
  const theme = normalizeTheme(uiState.theme);
  const density = normalizeDensity(uiState.density);
  const corners = normalizeCorners(uiState.corners);

  themeButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.theme === theme);
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });

  densityButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.density === density);
    button.setAttribute("aria-pressed", String(button.dataset.density === density));
  });

  cornerButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.corners === corners);
    button.setAttribute("aria-pressed", String(button.dataset.corners === corners));
  });
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openSettingsDialog() {
  syncAppearanceControls();

  if (settingsDialog.open) {
    return;
  }

  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
    return;
  }

  settingsDialog.setAttribute("open", "open");
}

function openDeleteDialog(task) {
  const message = task.recurring
    ? `Delete "${task.title}"? This recurring routine and its completion history will be removed.`
    : `Delete "${task.title}"? This task will be removed from your board.`;

  if (typeof confirmDialog.showModal !== "function") {
    if (window.confirm(message)) {
      tasks = tasks.filter((item) => item.id !== task.id);
      persistTasks();
      render();
    }

    return;
  }

  pendingDeleteTaskId = task.id;
  confirmMessage.textContent = message;

  if (!confirmDialog.open) {
    confirmDialog.showModal();
  }
}

function populateTimeOptions() {
  resetHourSelect.innerHTML = createNumberOptions(24);
  resetMinuteSelect.innerHTML = createNumberOptions(60);
  setTimePickerValue(DEFAULT_RESET_TIME);
}

function createNumberOptions(limit) {
  return Array.from({ length: limit }, (_, index) => {
    const value = String(index).padStart(2, "0");
    return `<option value="${value}">${value}</option>`;
  }).join("");
}

function setTimePickerValue(value) {
  const safeValue = isValidTime(value) ? value : DEFAULT_RESET_TIME;
  const [hours, minutes] = safeValue.split(":");
  resetHourSelect.value = hours;
  resetMinuteSelect.value = minutes;
}

function getTimePickerValue() {
  const hours = resetHourSelect.value || DEFAULT_RESET_TIME.slice(0, 2);
  const minutes = resetMinuteSelect.value || DEFAULT_RESET_TIME.slice(3, 5);
  return `${hours}:${minutes}`;
}

function startEditing(task) {
  editingTaskId = task.id;
  taskTitleInput.value = task.title;
  taskRecurringInput.checked = Boolean(task.recurring);
  taskNotesInput.value = task.notes ?? "";
  taskDueDateInput.value = task.dueDate ?? "";
  taskPriorityInput.value = task.priority ?? "medium";
  repeatModeSelect.value = task.recurring ? task.recurrence.mode : "daily";
  setTimePickerValue(task.recurring ? task.recurrence.resetTime : DEFAULT_RESET_TIME);
  weekdayInputs.forEach((input) => {
    input.checked = task.recurring
      ? task.recurrence.days.includes(Number(input.value))
      : false;
  });
  syncRecurringForm();
  syncFormMode();
  taskTitleInput.focus();
  taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingTaskId = null;
  taskForm.reset();
  taskRecurringInput.checked = false;
  taskPriorityInput.value = "medium";
  repeatModeSelect.value = "daily";
  setTimePickerValue(DEFAULT_RESET_TIME);
  weekdayInputs.forEach((input) => {
    input.checked = false;
  });
  syncRecurringForm();
  syncFormMode();
  taskTitleInput.focus();
}

function syncFormMode() {
  const isEditing = Boolean(editingTaskId);
  formMode.textContent = isEditing
    ? "Editing a task. Update the details below and save when you're ready."
    : "Tasks save in your browser automatically.";
  submitButton.textContent = isEditing ? "Save changes" : "Add task";
  cancelEditButton.hidden = !isEditing;
}

function syncEditingTaskState() {
  if (!editingTaskId) {
    return;
  }

  const taskStillExists = tasks.some((task) => task.id === editingTaskId);

  if (!taskStillExists) {
    resetForm();
  }
}

function syncRecurringForm() {
  const isRecurring = taskRecurringInput.checked;
  recurringFields.hidden = !isRecurring;
  dueDateField.hidden = isRecurring;
  weekdayFieldset.hidden = !isRecurring || repeatModeSelect.value !== "weekly";
}

function buildRecurrenceInput() {
  const mode = repeatModeSelect.value === "weekly" ? "weekly" : "daily";
  const days = Array.from(weekdayInputs)
    .filter((input) => input.checked)
    .map((input) => Number(input.value));
  const resetTime = getTimePickerValue();

  if (mode === "weekly" && days.length === 0) {
    window.alert("Pick at least one day for a weekly recurring task.");
    return null;
  }

  const recurrence = {
    mode,
    days: mode === "weekly" ? days : [new Date().getDay()],
    resetTime,
    lastCompletedCycleKey: ""
  };

  const previewTask = {
    recurring: true,
    recurrence
  };

  if (shouldAutocompleteCurrentCycleOnCreate(previewTask)) {
    recurrence.lastCompletedCycleKey = getRecurringCycleKey(previewTask);
  }

  return recurrence;
}

function isTaskCompleteNow(task) {
  if (!task.recurring) {
    return task.completed;
  }

  return task.recurrence.lastCompletedCycleKey === getRecurringCycleKey(task);
}

function setRecurringTaskCompletion(task, isComplete) {
  return {
    ...task,
    recurrence: {
      ...task.recurrence,
      lastCompletedCycleKey: isComplete ? getRecurringCycleKey(task) : ""
    }
  };
}

function shouldAutocompleteCurrentCycleOnCreate(task, now = new Date()) {
  const resetMinutes = parseTimeToMinutes(task.recurrence.resetTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (task.recurrence.mode === "daily") {
    return nowMinutes < resetMinutes;
  }

  const scheduledToday = task.recurrence.days.includes(now.getDay());
  return !scheduledToday || nowMinutes < resetMinutes;
}

function getRecurringCycleKey(task, now = new Date()) {
  if (!task.recurring || !task.recurrence) {
    return "";
  }

  const resetMinutes = parseTimeToMinutes(task.recurrence.resetTime);

  if (task.recurrence.mode === "weekly") {
    const days = task.recurrence.days.length > 0 ? task.recurrence.days : [now.getDay()];

    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(now);
      candidate.setHours(0, 0, 0, 0);
      candidate.setDate(candidate.getDate() - offset);

      if (!days.includes(candidate.getDay())) {
        continue;
      }

      const candidateAtReset = new Date(candidate);
      candidateAtReset.setHours(Math.floor(resetMinutes / 60), resetMinutes % 60, 0, 0);

      if (candidateAtReset <= now) {
        return formatDateKey(candidate);
      }
    }
  }

  const cycleDate = new Date(now);
  cycleDate.setHours(0, 0, 0, 0);

  if (now.getHours() * 60 + now.getMinutes() < resetMinutes) {
    cycleDate.setDate(cycleDate.getDate() - 1);
  }

  return formatDateKey(cycleDate);
}

function formatRecurringSchedule(task) {
  if (!task.recurring || !task.recurrence) {
    return "";
  }

  const daysLabel = task.recurrence.mode === "daily"
    ? "Every day"
    : task.recurrence.days
      .map((day) => WEEKDAY_LABELS[day])
      .join(", ");

  return `${daysLabel} - resets ${formatTimeLabel(task.recurrence.resetTime)}`;
}

function isValidTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeLabel(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function canManualReorder() {
  return currentSort === "manual" && currentFilter !== "completed" && !searchQuery;
}

function moveTaskByOffset(taskId, offset) {
  if (!canManualReorder()) {
    return;
  }

  const currentIndex = tasks.findIndex((task) => task.id === taskId);
  const nextIndex = currentIndex + offset;

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= tasks.length) {
    return;
  }

  const nextTasks = [...tasks];
  const [task] = nextTasks.splice(currentIndex, 1);
  nextTasks.splice(nextIndex, 0, task);
  tasks = nextTasks;
  persistTasks();
  render();
}

function moveTaskToPosition(draggedId, targetId, position) {
  const nextTasks = [...tasks];
  const draggedIndex = nextTasks.findIndex((task) => task.id === draggedId);

  if (draggedIndex === -1) {
    return;
  }

  const [draggedTask] = nextTasks.splice(draggedIndex, 1);
  const targetIndex = nextTasks.findIndex((task) => task.id === targetId);

  if (targetIndex === -1) {
    return;
  }

  const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex;
  nextTasks.splice(insertionIndex, 0, draggedTask);
  tasks = nextTasks;
  draggedTaskId = null;
  persistTasks();
  clearDragClasses();
  render();
}

function setDropIndicator(card, position) {
  clearDragClasses();
  card.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
}

function clearDragClasses() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
  });
}

function updateOrganizeHint() {
  if (currentSort !== "manual") {
    organizeHint.textContent = `Tasks are sorted by ${formatSortMode(currentSort)}. Switch to Manual order to drag them around.`;
    return;
  }

  if (currentFilter === "completed") {
    organizeHint.textContent = "Completed tasks stay in their own area. Switch tabs to reorder active tasks.";
    return;
  }

  if (searchQuery) {
    organizeHint.textContent = "Clear the search to drag tasks into a new saved order.";
    return;
  }

  if (getVisibleTasks().length < 2) {
    organizeHint.textContent = "Add at least two tasks and manual ordering will be ready.";
    return;
  }

  if (currentFilter === "recurring") {
    organizeHint.textContent = "Manual order is on for recurring routines. Drag the handle or use Move up / Move down to organize them.";
    return;
  }

  organizeHint.textContent = "Manual order is on. Drag the handle or use Move up / Move down to organize tasks however you want.";
}

function formatSortMode(sortMode) {
  if (sortMode === "priority") {
    return "priority";
  }

  if (sortMode === "due-soonest") {
    return "due date, soonest first";
  }

  if (sortMode === "due-latest") {
    return "due date, latest first";
  }

  if (sortMode === "newest") {
    return "newest first";
  }

  return "manual order";
}

function formatPriority(priority) {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

function formatDueDate(value) {
  const dueDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (dueDate.getTime() === today.getTime()) {
    return "Due today";
  }

  if (dueDate.getTime() === tomorrow.getTime()) {
    return "Due tomorrow";
  }

  const label = dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return isOverdue(value) ? `Overdue: ${label}` : `Due ${label}`;
}

function isOverdue(value) {
  if (!value) {
    return false;
  }

  const dueDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
