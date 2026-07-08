import { sb } from "./sb.js";

const LS_KEYS = {
  hasEnteredCode: "tr_hasEnteredCode",
  participantId: "tr_participantId",
};

const el = (id) => document.getElementById(id);

const screens = {
  gate: el("gate"),
  namePicker: el("namePicker"),
  main: el("mainApp"),
};

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle("hidden", key !== name);
  }
}

function showToast(message) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Date helpers (yyyy-MM-dd, matches the Postgres `date` column) ----
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

function formatHours(hours) {
  const rounded = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return rounded.replace(".", ",") + "t";
}

function formatAmount(amount) {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return rounded.replace(".", ",") + " kr";
}

// ---- Avatars: deterministic color + initials per name ----
const AVATAR_COLORS = ["#ffb340", "#ff6482", "#c774f0", "#6dc9ff", "#4ce0a1", "#ffd54c"];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsForName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return chars.join("") || "?";
}

function avatarHtml(name, size = "") {
  return `<span class="avatar ${size}" style="background:${colorForName(name)}">${initialsForName(name)}</span>`;
}

// ---- Sliding tab indicator ----
function moveTabIndicator(tabEl) {
  const indicator = el("mainApp").querySelector(".tab-indicator");
  indicator.style.width = `${tabEl.offsetWidth}px`;
  indicator.style.transform = `translateX(${tabEl.offsetLeft - 3}px)`;
}

// ---- App state ----
let currentParticipant = null;

// ---- Boot ----
async function boot() {
  const hasEnteredCode = localStorage.getItem(LS_KEYS.hasEnteredCode) === "1";
  if (!hasEnteredCode) {
    showScreen("gate");
    return;
  }

  try {
    await ensureSignedIn();
  } catch {
    showScreen("gate");
    return;
  }

  const savedId = localStorage.getItem(LS_KEYS.participantId);
  if (savedId) {
    const participants = await fetchParticipants();
    currentParticipant = participants.find((p) => p.id === savedId) ?? null;
  }

  if (currentParticipant) {
    enterMainApp();
  } else {
    await enterNamePicker();
  }
}

async function ensureSignedIn() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
  }
}

// ---- Access gate ----
el("gateSubmit").addEventListener("click", submitGate);
el("gateCode").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGate();
});

async function submitGate() {
  const code = el("gateCode").value.trim();
  const errorEl = el("gateError");
  errorEl.classList.add("hidden");

  if (!code) return;

  const btn = el("gateSubmit");
  btn.disabled = true;
  btn.textContent = "…";
  try {
    await ensureSignedIn();
    const { data: verified, error } = await sb.rpc("verify_access_code", { input_code: code });
    if (error) throw error;
    if (!verified) {
      errorEl.textContent = "Feil kode. Prøv igjen.";
      errorEl.classList.remove("hidden");
      return;
    }
    localStorage.setItem(LS_KEYS.hasEnteredCode, "1");
    await enterNamePicker();
  } catch {
    errorEl.textContent = "Kunne ikke koble til. Sjekk internettforbindelsen.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Fortsett";
  }
}

// ---- Name picker ----
async function enterNamePicker() {
  showScreen("namePicker");
  el("nameError").classList.add("hidden");
  const listEl = el("participantList");
  listEl.innerHTML = "<p class='muted'>Laster…</p>";
  try {
    const participants = await fetchParticipants();
    listEl.innerHTML = "";
    for (const p of participants) {
      const btn = document.createElement("button");
      btn.className = "list-item";
      btn.innerHTML = `${avatarHtml(p.name)}<span>${escapeHtml(p.name)}</span>`;
      btn.addEventListener("click", () => selectParticipant(p));
      listEl.appendChild(btn);
    }
  } catch {
    listEl.innerHTML = "";
    el("nameError").textContent = "Kunne ikke hente navn.";
    el("nameError").classList.remove("hidden");
  }
}

function selectParticipant(participant) {
  currentParticipant = participant;
  localStorage.setItem(LS_KEYS.participantId, participant.id);
  enterMainApp();
}

el("addNameBtn").addEventListener("click", addSelf);
el("newName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSelf();
});

async function addSelf() {
  const name = el("newName").value.trim();
  if (!name) return;
  const errorEl = el("nameError");
  errorEl.classList.add("hidden");
  const btn = el("addNameBtn");
  btn.disabled = true;
  try {
    const { data: userData } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("participants")
      .insert({ auth_user_id: userData.user.id, name })
      .select()
      .single();
    if (error) throw error;
    el("newName").value = "";
    selectParticipant(data);
  } catch {
    errorEl.textContent = "Kunne ikke legge til navn.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

async function fetchParticipants() {
  const { data, error } = await sb.from("participants").select().order("name");
  if (error) throw error;
  return data;
}

// ---- Main app ----
function enterMainApp() {
  showScreen("main");
  el("entryDate").value = todayString();
  el("entryDate").max = todayString();
  el("expenseDate").value = todayString();
  el("expenseDate").max = todayString();
  loadHistoryData();
  requestAnimationFrame(() => moveTabIndicator(document.querySelector(".tab.active")));
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    el(`tab-${tab.dataset.tab}`).classList.add("active");
    moveTabIndicator(tab);
    if (tab.dataset.tab === "history") loadHistoryData();
  });
});

window.addEventListener("resize", () => {
  const activeTab = document.querySelector(".tab.active");
  if (activeTab && !el("mainApp").classList.contains("hidden")) moveTabIndicator(activeTab);
});

el("switchUserBtn").addEventListener("click", () => {
  if (!confirm(`Bytt bruker fra ${currentParticipant.name}?`)) return;
  currentParticipant = null;
  localStorage.removeItem(LS_KEYS.participantId);
  enterNamePicker();
});

// Log entry
el("saveEntryBtn").addEventListener("click", saveEntry);

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

el("entryPhoto").addEventListener("change", () => {
  const file = el("entryPhoto").files[0];
  const preview = el("photoPreview");
  if (!file) {
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
});

async function uploadPhoto(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${currentParticipant.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("entry-photos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return sb.storage.from("entry-photos").getPublicUrl(path).data.publicUrl;
}

async function saveEntry() {
  const dateStr = el("entryDate").value;
  const hours = parseFloat(el("entryHours").value.replace(",", "."));
  const description = el("entryDescription").value.trim();
  const photoFile = el("entryPhoto").files[0] ?? null;
  const errorEl = el("logError");
  errorEl.classList.add("hidden");

  if (!dateStr || !Number.isFinite(hours) || hours <= 0 || hours > 24 || !description) {
    errorEl.textContent = "Fyll ut dato, timer og hva som ble gjort.";
    errorEl.classList.remove("hidden");
    return;
  }

  if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
    errorEl.textContent = "Bildet er for stort (maks 10 MB).";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = el("saveEntryBtn");
  btn.disabled = true;
  try {
    const photoUrl = photoFile ? await uploadPhoto(photoFile) : null;
    const { error } = await sb.from("time_entries").insert({
      participant_id: currentParticipant.id,
      entry_date: dateStr,
      hours,
      description,
      photo_url: photoUrl,
    });
    if (error) throw error;
    el("entryHours").value = "";
    el("entryDescription").value = "";
    el("entryDate").value = todayString();
    el("entryPhoto").value = "";
    el("photoPreview").classList.add("hidden");
    showToast("Lagret!");
  } catch {
    errorEl.textContent = "Kunne ikke lagre. Prøv igjen.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// Log expense
el("saveExpenseBtn").addEventListener("click", saveExpense);

el("expensePhoto").addEventListener("change", () => {
  const file = el("expensePhoto").files[0];
  const preview = el("expensePhotoPreview");
  if (!file) {
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
});

async function saveExpense() {
  const dateStr = el("expenseDate").value;
  const amount = parseFloat(el("expenseAmount").value.replace(",", "."));
  const description = el("expenseDescription").value.trim();
  const photoFile = el("expensePhoto").files[0] ?? null;
  const errorEl = el("expenseError");
  errorEl.classList.add("hidden");

  if (!dateStr || !Number.isFinite(amount) || amount <= 0 || !description) {
    errorEl.textContent = "Fyll ut dato, beløp og hva det gjaldt.";
    errorEl.classList.remove("hidden");
    return;
  }

  if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
    errorEl.textContent = "Bildet er for stort (maks 10 MB).";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = el("saveExpenseBtn");
  btn.disabled = true;
  try {
    const photoUrl = photoFile ? await uploadPhoto(photoFile) : null;
    const { error } = await sb.from("expenses").insert({
      participant_id: currentParticipant.id,
      expense_date: dateStr,
      amount,
      description,
      photo_url: photoUrl,
    });
    if (error) throw error;
    el("expenseAmount").value = "";
    el("expenseDescription").value = "";
    el("expenseDate").value = todayString();
    el("expensePhoto").value = "";
    el("expensePhotoPreview").classList.add("hidden");
    showToast("Utlegg lagret!");
  } catch {
    errorEl.textContent = "Kunne ikke lagre. Prøv igjen.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// History
let allEntries = [];
let allExpenses = [];
let historyFilter = "all";
let historyType = "hours";

document.querySelectorAll(".type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    historyType = btn.dataset.type;
    renderHistory();
  });
});

document.querySelectorAll(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    historyFilter = btn.dataset.filter;
    renderHistory();
  });
});

async function loadHistoryData() {
  const listEl = el("entryList");
  listEl.innerHTML = "<p class='empty-state'>Laster…</p>";
  try {
    const [entriesRes, expensesRes] = await Promise.all([
      sb.from("time_entries").select("*, participants(name)").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("expenses").select("*, participants(name)").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (entriesRes.error) throw entriesRes.error;
    if (expensesRes.error) throw expensesRes.error;
    allEntries = entriesRes.data;
    allExpenses = expensesRes.data;
    renderHistory();
  } catch {
    listEl.innerHTML = "<p class='empty-state error'>Kunne ikke hente historikk.</p>";
  }
}

function renderHistory() {
  if (historyType === "hours") {
    renderHoursTotals();
    renderHoursList();
  } else {
    renderExpenseTotals();
    renderExpenseList();
  }
}

function renderHoursList() {
  const listEl = el("entryList");
  const entries = historyFilter === "mine"
    ? allEntries.filter((e) => e.participant_id === currentParticipant.id)
    : allEntries;

  if (entries.length === 0) {
    listEl.innerHTML = "<p class='empty-state'>Ingen registreringer ennå.</p>";
    return;
  }

  listEl.innerHTML = "";
  for (const entry of entries) {
    const isMine = entry.participant_id === currentParticipant.id;
    const row = document.createElement("div");
    row.className = "entry-row";
    row.innerHTML = `
      <div class="entry-top">
        <div class="entry-name-group">
          ${avatarHtml(entry.participants.name, "lg")}
          <span class="entry-name ${isMine ? "mine" : ""}">${escapeHtml(entry.participants.name)}</span>
        </div>
        <span class="entry-hours">${formatHours(entry.hours)}</span>
        ${isMine ? `<button class="entry-edit-btn" data-id="${entry.id}" data-kind="hours" title="Rediger">✏️</button>` : ""}
      </div>
      ${entry.photo_url ? `<a href="${entry.photo_url}" target="_blank" rel="noopener"><img class="entry-photo" src="${entry.photo_url}" alt=""></a>` : ""}
      <p class="entry-desc">${escapeHtml(entry.description)}</p>
      <p class="entry-date">${formatDateDisplay(entry.entry_date)}</p>
    `;
    listEl.appendChild(row);
  }
}

function renderExpenseList() {
  const listEl = el("entryList");
  const expenses = historyFilter === "mine"
    ? allExpenses.filter((e) => e.participant_id === currentParticipant.id)
    : allExpenses;

  if (expenses.length === 0) {
    listEl.innerHTML = "<p class='empty-state'>Ingen utlegg ennå.</p>";
    return;
  }

  listEl.innerHTML = "";
  for (const expense of expenses) {
    const isMine = expense.participant_id === currentParticipant.id;
    const row = document.createElement("div");
    row.className = "entry-row";
    row.innerHTML = `
      <div class="entry-top">
        <div class="entry-name-group">
          ${avatarHtml(expense.participants.name, "lg")}
          <span class="entry-name ${isMine ? "mine" : ""}">${escapeHtml(expense.participants.name)}</span>
        </div>
        <span class="entry-hours">${formatAmount(expense.amount)}</span>
        ${isMine ? `<button class="entry-edit-btn" data-id="${expense.id}" data-kind="expenses" title="Rediger">✏️</button>` : ""}
      </div>
      ${expense.photo_url ? `<a href="${expense.photo_url}" target="_blank" rel="noopener"><img class="entry-photo" src="${expense.photo_url}" alt=""></a>` : ""}
      <p class="entry-desc">${escapeHtml(expense.description)}</p>
      <p class="entry-date">${formatDateDisplay(expense.expense_date)}</p>
    `;
    listEl.appendChild(row);
  }
}

el("entryList").addEventListener("click", (e) => {
  const btn = e.target.closest(".entry-edit-btn");
  if (!btn) return;
  const kind = btn.dataset.kind;
  const list = kind === "hours" ? allEntries : allExpenses;
  const entry = list.find((en) => en.id === btn.dataset.id);
  if (entry) openEditModal(entry, kind);
});

// ---- Edit / delete entry ----
let editingEntryId = null;
let editingKind = null;

function openEditModal(entry, kind) {
  editingEntryId = entry.id;
  editingKind = kind;
  el("editDate").value = kind === "hours" ? entry.entry_date : entry.expense_date;
  el("editDate").max = todayString();
  el("editAmountLabel").textContent = kind === "hours" ? "Timer" : "Beløp (kr)";
  el("editDescriptionLabel").textContent = kind === "hours" ? "Hva ble gjort?" : "Hva gjaldt det?";
  el("editHours").value = kind === "hours"
    ? String(entry.hours).replace(".", ",")
    : String(entry.amount).replace(".", ",");
  el("editDescription").value = entry.description;
  el("editError").classList.add("hidden");
  el("editModal").classList.remove("hidden");
}

function closeEditModal() {
  editingEntryId = null;
  editingKind = null;
  el("editModal").classList.add("hidden");
}

el("editCancelBtn").addEventListener("click", closeEditModal);
el("editModal").addEventListener("click", (e) => {
  if (e.target === el("editModal")) closeEditModal();
});

el("editSaveBtn").addEventListener("click", async () => {
  const dateStr = el("editDate").value;
  const amount = parseFloat(el("editHours").value.replace(",", "."));
  const description = el("editDescription").value.trim();
  const errorEl = el("editError");
  errorEl.classList.add("hidden");

  const valid = editingKind === "hours"
    ? dateStr && Number.isFinite(amount) && amount > 0 && amount <= 24 && description
    : dateStr && Number.isFinite(amount) && amount > 0 && description;

  if (!valid) {
    errorEl.textContent = "Fyll ut alle feltene riktig.";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = el("editSaveBtn");
  btn.disabled = true;
  try {
    const table = editingKind === "hours" ? "time_entries" : "expenses";
    const payload = editingKind === "hours"
      ? { entry_date: dateStr, hours: amount, description }
      : { expense_date: dateStr, amount, description };
    const { error } = await sb.from(table).update(payload).eq("id", editingEntryId);
    if (error) throw error;
    closeEditModal();
    showToast("Oppdatert!");
    await loadHistoryData();
  } catch {
    errorEl.textContent = "Kunne ikke lagre endringer.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

el("editDeleteBtn").addEventListener("click", async () => {
  if (!confirm("Slette denne registreringen?")) return;
  const btn = el("editDeleteBtn");
  btn.disabled = true;
  try {
    const table = editingKind === "hours" ? "time_entries" : "expenses";
    const { error } = await sb.from(table).delete().eq("id", editingEntryId);
    if (error) throw error;
    closeEditModal();
    showToast("Slettet");
    await loadHistoryData();
  } catch {
    el("editError").textContent = "Kunne ikke slette.";
    el("editError").classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

function renderHoursTotals() {
  const totalsEl = el("totals");
  const byPerson = {};
  for (const entry of allEntries) {
    const name = entry.participants.name;
    byPerson[name] = (byPerson[name] ?? 0) + entry.hours;
  }
  const sorted = Object.entries(byPerson).sort((a, b) => b[1] - a[1]);
  totalsEl.innerHTML = sorted
    .map(
      ([name, total]) => `
      <div class="total-card">
        ${avatarHtml(name)}
        <div class="total-info">
          <span class="total-name">${escapeHtml(name)}</span>
          <span class="total-hours">${formatHours(total)}</span>
        </div>
      </div>
    `
    )
    .join("");
}

function renderExpenseTotals() {
  const totalsEl = el("totals");
  const byPerson = {};
  for (const expense of allExpenses) {
    const name = expense.participants.name;
    byPerson[name] = (byPerson[name] ?? 0) + expense.amount;
  }
  const sorted = Object.entries(byPerson).sort((a, b) => b[1] - a[1]);
  totalsEl.innerHTML = sorted
    .map(
      ([name, total]) => `
      <div class="total-card">
        ${avatarHtml(name)}
        <div class="total-info">
          <span class="total-name">${escapeHtml(name)}</span>
          <span class="total-hours">${formatAmount(total)}</span>
        </div>
      </div>
    `
    )
    .join("");
}

// ---- CSV export ----
function csvEscape(value) {
  const str = String(value ?? "");
  return /[;"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(header, rows, filenameBase) {
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-${todayString()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  if (historyType === "hours") {
    const entries = historyFilter === "mine"
      ? allEntries.filter((e) => e.participant_id === currentParticipant.id)
      : allEntries;
    const rows = entries.map((e) => [e.participants.name, e.entry_date, String(e.hours).replace(".", ","), e.description]);
    downloadCsv(["Navn", "Dato", "Timer", "Beskrivelse"], rows, "timeregistrering");
  } else {
    const expenses = historyFilter === "mine"
      ? allExpenses.filter((e) => e.participant_id === currentParticipant.id)
      : allExpenses;
    const rows = expenses.map((e) => [e.participants.name, e.expense_date, String(e.amount).replace(".", ","), e.description]);
    downloadCsv(["Navn", "Dato", "Beløp", "Beskrivelse"], rows, "utlegg");
  }
}

el("exportBtn").addEventListener("click", exportCsv);

boot();
