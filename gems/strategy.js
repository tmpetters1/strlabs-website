async function load() {
  document.getElementById("nav-root").innerHTML = Desk.navHtml("strategy");
  const md = await Desk.fetchText("./data/strategy.md");
  document.getElementById("strategy-body").innerHTML = Desk.mdToHtml(md);
}

Desk.boot(load);
