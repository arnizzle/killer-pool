
async function load() {
  const res = await fetch("/api/state");
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("❌ /api/state returned non-JSON:", text);
    return;
  }

  if (!Array.isArray(data.players)) {
    console.error("❌ Invalid /api/state response:", data);
    return;
  }

  renderSelectedPlayers(data.players);

  document.body.classList.toggle("game-started", data.gameStarted);
}


async function loadKnownPlayers() {
  const res = await fetch("/api/players/known");
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("❌ /api/players/known returned non-JSON:", text);
    return;
  }

  if (!data || !Array.isArray(data.players)) {
    console.error("❌ Invalid known players response:", data);
    return;
  }

  const container = document.getElementById("known");
  if (!container) {
    console.warn("❌ #known container not found");
    return;
  }

  container.innerHTML = "";

  data.players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player known";

    div.textContent = `${p.emoji || ""} ${p.name}`;

    div.onclick = () => addKnownPlayer(p.id);

    container.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 index.js DOM ready → calling load()");
  load();
  loadKnownPlayers();
});


async function addKnownPlayer(playerId) {
  const res = await fetch("/api/players/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: playerId })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Failed to add known player:", text);
    return;
  }

  // Refresh selected players
  load();
}

async function removePlayer(playerId) {
  const res = await fetch("/api/players/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: playerId })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Failed to remove player:", text);
    return;
  }

  // Refresh selected players
  load();
}


function renderSelectedPlayers(players) {
  const container = document.getElementById("selected");
  if (!container) {
    console.warn("❌ renderSelectedPlayers: #selected not found");
    return;
  }

  container.innerHTML = "";

  if (!players.length) {
    container.innerHTML = "<em>No players selected</em>";
    return;
  }

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player selected";

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${p.emoji || ""} ${p.name}`;

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "✕";
    remove.onclick = () => removePlayer(p.id);

    div.appendChild(name);
    div.appendChild(remove);
    container.appendChild(div);
  });
}

async function slotRandomize() {
  const container = document.getElementById("selected");
  if (!container) {
    console.warn("❌ slotRandomize: #selected not found");
    return;
  }

  const rows = Array.from(container.children);
  if (rows.length < 2) return;

  // Capture original names
  const names = rows.map(r => r.querySelector(".player-name")?.textContent || r.textContent);

  let spins = 15;
  const interval = setInterval(() => {
    rows.forEach(row => {
      const random = names[Math.floor(Math.random() * names.length)];
      const span = row.querySelector(".player-name") || row;
      span.textContent = random;
    });

    spins--;
    if (spins <= 0) {
      clearInterval(interval);
      finishRandomize();
    }
  }, 80);

  async function finishRandomize() {
    const res = await fetch("/api/players/randomize", {
      method: "POST"
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Randomize failed:", text);
      return;
    }

    // Reload authoritative state
    await load();
  }
}
