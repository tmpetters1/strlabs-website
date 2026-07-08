import { sb } from "./sb.js";
import { ACCESS_CODE } from "./config.js";

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

  if (!code || code.toLowerCase() !== ACCESS_CODE.toLowerCase()) {
    errorEl.textContent = "Feil kode. Prøv igjen.";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = el("gateSubmit");
  btn.disabled = true;
  btn.textContent = "…";
  try {
    await ensureSignedIn();
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
  loadHistory();
  requestAnimationFrame(() => moveTabIndicator(document.querySelector(".tab.active")));
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    el(`tab-${tab.dataset.tab}`).classList.add("active");
    moveTabIndicator(tab);
    if (tab.dataset.tab === "history") loadHistory();
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

async function saveEntry() {
  const dateStr = el("entryDate").value;
  const hours = parseFloat(el("entryHours").value.replace(",", "."));
  const description = el("entryDescription").value.trim();
  const errorEl = el("logError");
  errorEl.classList.add("hidden");

  if (!dateStr || !Number.isFinite(hours) || hours <= 0 || hours > 24 || !description) {
    errorEl.textContent = "Fyll ut dato, timer og hva som ble gjort.";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = el("saveEntryBtn");
  btn.disabled = true;
  try {
    const { error } = await sb.from("time_entries").insert({
      participant_id: currentParticipant.id,
      entry_date: dateStr,
      hours,
      description,
    });
    if (error) throw error;
    el("entryHours").value = "";
    el("entryDescription").value = "";
    el("entryDate").value = todayString();
    showToast("Lagret!");
  } catch {
    errorEl.textContent = "Kunne ikke lagre. Prøv igjen.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// History
let allEntries = [];
let historyFilter = "all";

document.querySelectorAll(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    historyFilter = btn.dataset.filter;
    renderHistory();
  });
});

async function loadHistory() {
  const listEl = el("entryList");
  listEl.innerHTML = "<p class='empty-state'>Laster…</p>";
  try {
    const { data, error } = await sb
      .from("time_entries")
      .select("*, participants(name)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    allEntries = data;
    renderHistory();
  } catch {
    listEl.innerHTML = "<p class='empty-state error'>Kunne ikke hente historikk.</p>";
  }
}

function renderHistory() {
  renderTotals();
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
      </div>
      <p class="entry-desc">${escapeHtml(entry.description)}</p>
      <p class="entry-date">${formatDateDisplay(entry.entry_date)}</p>
    `;
    listEl.appendChild(row);
  }
}

function renderTotals() {
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

boot();
