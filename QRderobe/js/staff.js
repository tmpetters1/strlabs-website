// Staff SPA — hash router with four views.
//
//   #/dropoff          drop-off picker (default)
//   #/queue            live pickup queue
//   #/pickup/:tid      pickup detail for one ticket
//   #/inventory        all-hangers visual grid

import { sb, fn } from "./sb.js";
import { tile, colorFor, colorForNumber } from "./colors.js";
import { DEFAULT_VENUE_SLUG } from "./config.js";

// ---------- state ----------
const state = {
  venue: null,
  racks: [],
  // ticket lists kept in memory + replaced by realtime
  paidTickets: [],
  requestedTickets: [],
  hangers: [], // full inventory
  activeRackId: localStorage.getItem("qrd:activeRackId"),
};

const $root  = document.getElementById("root");
const $modal = document.getElementById("modal-root");

// ---------- boot ----------
await loadVenueAndRacks();
await refreshAll();
subscribeRealtime();
window.addEventListener("hashchange", route);
route();

// Default route
if (!location.hash) location.hash = "#/dropoff";

// ---------- data ----------
async function loadVenueAndRacks() {
  const { data: v } = await sb.from("venues")
    .select("id, slug, name, fee_nok, color_config")
    .eq("slug", DEFAULT_VENUE_SLUG).single();
  state.venue = v;

  const { data: r } = await sb.from("racks")
    .select("id, name, display_order, capacity, active")
    .eq("venue_id", v.id).order("display_order");
  state.racks = r ?? [];

  if (!state.activeRackId && state.racks.length) {
    state.activeRackId = state.racks[0].id;
    localStorage.setItem("qrd:activeRackId", state.activeRackId);
  }
}

async function refreshAll() {
  const [paid, requested, hangers] = await Promise.all([
    sb.from("tickets").select("id, status, vipps_reference, paid_at, amount_nok")
      .eq("venue_id", state.venue.id).eq("status", "paid").order("paid_at"),
    sb.from("tickets").select("id, status, vipps_reference, hanger_id, requested_at, placed_at")
      .eq("venue_id", state.venue.id).eq("status", "requested").order("requested_at"),
    sb.from("hangers").select("id, number, color, status, current_rack_id, placed_at")
      .eq("venue_id", state.venue.id).order("number"),
  ]);
  state.paidTickets      = paid.data ?? [];
  state.requestedTickets = requested.data ?? [];
  state.hangers          = hangers.data ?? [];
  updateQueueBadge();
}

function subscribeRealtime() {
  sb.channel("tickets-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, async () => {
      await refreshAll();
      route(); // re-render current view
    })
    .subscribe();

  sb.channel("hangers-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "hangers" }, async () => {
      await refreshAll();
      route();
    })
    .subscribe();
}

function updateQueueBadge() {
  const $b = document.getElementById("queue-count");
  if (!$b) return;
  $b.textContent = state.requestedTickets.length;
  $b.classList.toggle("badge-warn", state.requestedTickets.length > 0);
}

// ---------- routing ----------
function route() {
  const h = location.hash || "#/dropoff";
  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));

  if (h.startsWith("#/dropoff"))    { activate("dropoff");   renderDropoff();   }
  else if (h.startsWith("#/queue")) { activate("queue");     renderQueue();     }
  else if (h.startsWith("#/inventory")) { activate("inventory"); renderInventory(); }
  else if (h.startsWith("#/pickup/")) {
    activate("queue");
    const id = h.split("/")[2];
    renderPickup(id);
  }
}

function activate(name) {
  document.querySelectorAll(".nav a").forEach(a => {
    if (a.dataset.tab === name) a.classList.add("active");
  });
}

// ---------- drop-off ----------
function renderDropoff() {
  const rack = state.racks.find(r => r.id === state.activeRackId);
  const onRack = state.hangers.filter(h => h.status === "in_use" && h.current_rack_id === state.activeRackId);

  $root.innerHTML = `
    <div class="card">
      <div class="row-between mb-12">
        <h2>Active rack</h2>
        <span class="badge">${onRack.length} / ${rack?.capacity ?? "—"}</span>
      </div>
      <button id="rack-pick" class="btn">${rack?.name ?? "Pick a rack"}</button>
    </div>

    <div class="card">
      <h2 class="mb-12">Awaiting drop-off</h2>
      <p class="sub">Guests who paid but haven't handed their jacket over yet.</p>
      <div id="paid-list" class="list mt-12"></div>
    </div>
  `;

  document.getElementById("rack-pick").addEventListener("click", openRackPicker);
  renderPaidList();
}

function renderPaidList() {
  const $list = document.getElementById("paid-list");
  if (!$list) return;
  if (!state.paidTickets.length) {
    $list.innerHTML = `<div class="empty">No paid tickets waiting. Guests will appear here after they tap Vipps.</div>`;
    return;
  }
  $list.innerHTML = state.paidTickets.map(t => `
    <div class="list-item" data-ticket="${t.id}">
      <div class="badge badge-good">Paid</div>
      <div class="grow">
        <div class="strong">${t.amount_nok} kr</div>
        <div class="muted" style="font-size: 0.78rem; font-family: ui-monospace, monospace;">${t.vipps_reference}</div>
      </div>
      <div class="muted">${formatAgo(t.paid_at)}</div>
    </div>
  `).join("");
  $list.querySelectorAll(".list-item").forEach(el => {
    el.addEventListener("click", () => openHangerPicker(el.dataset.ticket));
  });
}

function openRackPicker() {
  const html = `
    <div class="modal-backdrop open">
      <div class="modal">
        <h3>Pick active rack</h3>
        <div class="list">
          ${state.racks.map(r => {
            const used = state.hangers.filter(h => h.status==="in_use" && h.current_rack_id===r.id).length;
            return `<div class="list-item" data-rack="${r.id}">
              <div class="grow"><div class="strong">${r.name}</div><div class="muted">${used} / ${r.capacity}</div></div>
              ${r.id === state.activeRackId ? '<span class="badge badge-good">Active</span>' : ''}
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>`;
  $modal.innerHTML = html;
  $modal.querySelectorAll(".list-item").forEach(el => {
    el.addEventListener("click", () => {
      state.activeRackId = el.dataset.rack;
      localStorage.setItem("qrd:activeRackId", state.activeRackId);
      $modal.innerHTML = "";
      renderDropoff();
    });
  });
  $modal.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) $modal.innerHTML = "";
  });
}

function openHangerPicker(ticketId) {
  const free = state.hangers.filter(h => h.status === "free").sort((a,b)=>a.number-b.number);
  $modal.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal">
        <h3>Tap the hanger you used</h3>
        <p class="muted mb-12" style="font-size: 0.85rem;">Stand-in for NFC. Pick the hanger by number.</p>
        <div class="hgrid" id="free-grid"></div>
        <p class="smaller mt-12 center">${free.length} free</p>
      </div>
    </div>
  `;
  const $grid = document.getElementById("free-grid");
  free.forEach(h => {
    const el = tile(h.number, h.color, "md");
    el.style.cursor = "pointer";
    el.addEventListener("click", async () => {
      el.style.opacity = "0.5";
      try {
        await fn("place-ticket", {
          ticket_id: ticketId,
          hanger_id: h.id,
          rack_id: state.activeRackId,
        });
        $modal.innerHTML = "";
        flash(`Placed · ${h.color} ${h.number}`);
      } catch (e) {
        flash(`Failed: ${e.message}`, "bad");
        el.style.opacity = "1";
      }
    });
    $grid.appendChild(el);
  });
  $modal.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) $modal.innerHTML = "";
  });
}

// ---------- queue ----------
async function renderQueue() {
  if (!state.requestedTickets.length) {
    $root.innerHTML = `
      <div class="card">
        <h2>Pickup queue</h2>
        <p class="sub">Live — guests appear when they tap "I'm coming".</p>
        <div class="empty">All clear. Stand by.</div>
      </div>`;
    return;
  }

  // Smart hint: count how many are on the same rack
  const rackBuckets = {};
  for (const t of state.requestedTickets) {
    if (!t.hanger_id) continue;
    const h = state.hangers.find(x => x.id === t.hanger_id);
    if (!h?.current_rack_id) continue;
    rackBuckets[h.current_rack_id] = (rackBuckets[h.current_rack_id] ?? 0) + 1;
  }
  const top = Object.entries(rackBuckets).sort((a,b)=>b[1]-a[1])[0];
  let hint = "";
  if (top && top[1] >= 2) {
    const rack = state.racks.find(r => r.id === top[0]);
    hint = `<div class="card-tight mb-12" style="background: rgba(133,183,235,0.10); border: 1px solid rgba(133,183,235,0.35); border-radius: var(--r-md); padding: 12px 14px; color: #b0d1f3; font-size: 0.88rem;">
              ${top[1]} of next ${state.requestedTickets.length} jackets are on <strong>${rack?.name ?? "—"}</strong> — grab them in one sweep.
            </div>`;
  }

  $root.innerHTML = `
    <div class="card">
      <div class="row-between mb-12">
        <h2>Pickup queue</h2>
        <span class="badge badge-warn">${state.requestedTickets.length} waiting</span>
      </div>
      ${hint}
      <div class="list" id="q-list"></div>
    </div>
  `;

  const $q = document.getElementById("q-list");
  state.requestedTickets.forEach(t => {
    const h = state.hangers.find(x => x.id === t.hanger_id);
    const rack = state.racks.find(r => r.id === h?.current_rack_id);
    const c = h ? colorForNumber(h.number) : null;
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="hanger-tile md" style="background:${c?.tint_hex ?? '#333'};border:1px solid ${c?.border_hex ?? '#666'};color:${c?.text_hex ?? '#fff'};">${h?.number ?? "?"}</div>
      <div class="grow">
        <div class="strong">${rack?.name ?? "—"}</div>
        <div class="muted" style="font-size: 0.82rem;">${h ? `${h.color} ${h.number}` : "no hanger"} · ${formatAgo(t.requested_at)}</div>
      </div>
      <div class="muted">→</div>
    `;
    el.addEventListener("click", () => { location.hash = `#/pickup/${t.id}`; });
    $q.appendChild(el);
  });
}

// ---------- pickup detail ----------
async function renderPickup(ticketId) {
  const ticket = state.requestedTickets.find(t => t.id === ticketId);
  if (!ticket) {
    // Maybe already returned — reload and try once
    await refreshAll();
    const again = state.requestedTickets.find(t => t.id === ticketId);
    if (!again) {
      $root.innerHTML = `<div class="card"><h2>Ticket not in queue</h2><p class="sub">It may have been returned already.</p><a href="#/queue" class="btn mt-12">Back to queue</a></div>`;
      return;
    }
  }
  const t  = ticket ?? state.requestedTickets.find(x => x.id === ticketId);
  const h  = state.hangers.find(x => x.id === t.hanger_id);
  const c  = h ? colorForNumber(h.number) : null;
  const rack = state.racks.find(r => r.id === h?.current_rack_id);

  // All hangers on this rack, ordered by placed_at — that gives us position-from-front.
  const onRack = state.hangers
    .filter(x => x.status === "in_use" && x.current_rack_id === rack?.id)
    .sort((a,b) => new Date(a.placed_at) - new Date(b.placed_at));
  const idx = onRack.findIndex(x => x.id === h?.id);

  // Mini-rack cells
  const cellsHtml = onRack.map((x, i) => {
    const cc = colorForNumber(x.number);
    const isTarget = x.id === h?.id;
    return `<div class="${isTarget ? 'target' : ''}" style="background:${cc.hex};"></div>`;
  }).join("");

  // Next in queue (excluding current)
  const upcoming = state.requestedTickets
    .filter(x => x.id !== ticketId)
    .slice(0, 3)
    .map(x => {
      const xh = state.hangers.find(y => y.id === x.hanger_id);
      const xrack = state.racks.find(r => r.id === xh?.current_rack_id);
      const xc = xh ? colorForNumber(xh.number) : null;
      const xOnRack = xh ? state.hangers
        .filter(y => y.status === "in_use" && y.current_rack_id === xh.current_rack_id)
        .sort((a,b) => new Date(a.placed_at) - new Date(b.placed_at)) : [];
      const xIdx = xh ? xOnRack.findIndex(y => y.id === xh.id) + 1 : 0;
      const sameRack = xrack?.id === rack?.id;
      return `
        <div class="row" style="padding: 6px 0; font-size: 0.88rem;">
          <div class="hanger-tile sm" style="background:${xc?.tint_hex};border:1px solid ${xc?.border_hex};color:${xc?.text_hex};">${xh?.number ?? "?"}</div>
          <div class="grow">${xrack?.name ?? "—"} · ${xIdx ? `${ord(xIdx)} from front` : ""}</div>
          <span class="smaller">${sameRack ? "same rack" : "walk over"}</span>
        </div>
      `;
    }).join("");

  $root.innerHTML = `
    <a href="#/queue" class="muted" style="font-size: 0.85rem;">← Back to queue</a>
    <div class="card mt-12">
      <div class="row-between mb-12">
        <div class="row">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--good);"></span>
          <span style="font-size: 0.92rem;">Guest at counter</span>
        </div>
        <span class="badge badge-good">Paid</span>
      </div>

      <div class="row mb-12">
        <div class="hanger-tile lg" style="background:${c?.tint_hex};border:1.5px solid ${c?.border_hex};color:${c?.text_hex};">${h?.number ?? "?"}</div>
        <div class="grow">
          <div class="muted" style="font-size: 0.82rem;">${h?.color ?? ""} ${h?.number ?? ""}</div>
          <div style="font-weight: 600;">${rack?.name ?? "—"}</div>
        </div>
        <div style="text-align: right;">
          <div class="smaller">Position</div>
          <div style="font-weight: 600;">${idx >= 0 ? `${ord(idx + 1)} from front` : "—"}</div>
        </div>
      </div>

      <div class="rack">
        <div class="rack-labels">
          <span>Front of rack</span>
          <span>Back</span>
        </div>
        <div class="rack-cells">${cellsHtml}</div>
        <div class="rack-meta">${onRack.length} hangers on rack · live</div>
      </div>

      <div class="btn-row mt-18">
        <button id="issue" class="btn">Mark issue</button>
        <button id="ret"   class="btn btn-primary" style="flex: 2;">Tap to return ↗</button>
      </div>
    </div>

    ${upcoming ? `
    <div class="card">
      <div class="muted mb-8" style="font-size: 0.82rem;">Next in queue · plan your route</div>
      ${upcoming}
    </div>` : ""}
  `;

  document.getElementById("ret").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spin"></span> Returning…';
    try {
      await fn("return-ticket", { ticket_id: t.id });
      flash(`Returned · ${h?.color ?? ""} ${h?.number ?? ""}`);
      location.hash = "#/queue";
    } catch (err) {
      flash(`Failed: ${err.message}`, "bad");
      e.target.disabled = false;
      e.target.innerHTML = "Tap to return ↗";
    }
  });

  document.getElementById("issue").addEventListener("click", () => {
    flash("Issue flow not built yet — talk to the guest");
  });
}

// ---------- inventory ----------
function renderInventory() {
  const free = state.hangers.filter(h => h.status === "free").length;
  const used = state.hangers.filter(h => h.status === "in_use").length;

  $root.innerHTML = `
    <div class="card">
      <div class="row-between mb-12">
        <h2>Hanger inventory</h2>
        <span class="badge">${used} / ${state.hangers.length}</span>
      </div>
      <p class="sub">${free} free · ${used} in use</p>
      <div class="hgrid mt-12" id="inv"></div>
    </div>
  `;
  const $inv = document.getElementById("inv");
  state.hangers.forEach(h => {
    const el = tile(h.number, h.color, "md");
    if (h.status !== "free") {
      el.style.opacity = "0.42";
      el.style.outline = "1.5px solid var(--text-2)";
    }
    el.title = `${h.color} ${h.number} · ${h.status}`;
    $inv.appendChild(el);
  });
}

// ---------- helpers ----------
function formatAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
function ord(n) {
  const s = ["th","st","nd","rd"]; const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function flash(msg, tone = "good") {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed; left:50%; bottom:32px; transform:translateX(-50%);
    background: ${tone==="bad" ? "var(--bad)" : "var(--good)"}; color:#fff;
    padding: 10px 16px; border-radius: var(--r-md); font-weight: 600; z-index: 999;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
