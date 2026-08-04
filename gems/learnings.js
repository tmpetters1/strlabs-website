function renderTimeline(entries) {
  const root = document.getElementById("timeline");
  if (!entries.length) {
    root.innerHTML = '<div class="empty">No learnings recorded yet.</div>';
    return;
  }
  root.innerHTML = entries
    .map(
      (e) => `<article class="tl-item">
        <div class="tl-head"><div class="tl-title">${Desk.esc(e.title || "Untitled")}</div><div class="tl-date mono">${Desk.esc(e.date || "")}</div></div>
        ${e.observation ? `<div class="tl-row"><span class="k">Observation</span>${Desk.esc(e.observation)}</div>` : ""}
        ${e.action ? `<div class="tl-row"><span class="k">Action</span>${Desk.esc(e.action)}</div>` : ""}
        ${e.owner ? `<div class="tl-row tl-owner"><span class="badge blue">${Desk.esc(e.owner)}</span></div>` : ""}
      </article>`
    )
    .join("");
}

async function load() {
  document.getElementById("nav-root").innerHTML = Desk.navHtml("learnings");
  const data = await Desk.fetchJson("./data/learnings.json");
  document.getElementById("generated-at").textContent = Desk.fmtTime(data.generated_at);
  renderTimeline(data.entries || []);
}

Desk.boot(load);
