let lastPlayerNames = [];
let editLocked = false;

function renderSelectedPlayers() {
  const selected = document.getElementById("selected");
  if (!selected) return;

  selected.innerHTML = "";

  selectedPlayers.forEach(p => {
    const div = document.createElement("div");
    div.className = "player selected";
    div.textContent = p.name;

    if (!editLocked) {
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.textContent = "✕";
      remove.onclick = () => removePlayer(p.id);
      div.appendChild(remove);
    }

    selected.appendChild(div);
  });
}


async function load() {
  const res = await fetch("/api/state");
  const data = await res.json();

  const playersEl = document.getElementById("players");
  const currentNames = data.players.map(p => p.name);

  // Detect ADD / REMOVE
  const added = currentNames.filter(n => !lastPlayerNames.includes(n));
  const removed = lastPlayerNames.filter(n => !currentNames.includes(n));

  // If no structural change, do NOTHING (prevents flicker)
  if (added.length === 0 && removed.length === 0) {
    return;
  }

  playersEl.innerHTML = "";

  data.players.forEach(p => {
    const row = document.createElement("div");
    row.className = "player";

    if (added.includes(p.name)) {
      row.classList.add("fade-in");
    }

    const name = document.createElement("span");
    name.textContent = p.name;
    row.appendChild(name);

    if (!data.gameStarted) {
      const remove = document.createElement("button");
      remove.textContent = "✕";

      remove.onclick = async () => {
        row.classList.add("fade-out");

        setTimeout(async () => {
          await fetch("/api/players/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: p.name })
          });

          load();
          loadKnownPlayers();
        }, 180);
      };

      row.appendChild(remove);
    }

    playersEl.appendChild(row);
  });

    // Update selected players UI
  renderSelectedPlayers();

  
  lastPlayerNames = currentNames;
}

async function newGame() {
  const passwordInput = document.getElementById("adminPassword");
  const password = passwordInput?.value;

  if (!password) {
    alert("Enter admin password");
    return;
  }

  const res = await fetch("/api/admin/newgame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    alert("Wrong password");
    return;
  }

  passwordInput.value = "";
  await load(); // refresh players + state
}

async function slotRandomize() {
  console.log("Slot randomize called ");
  const res = await fetch(API.slotRandomize, { method: "POST" });

  if (!res.ok) {
    console.warn("Randomize rejected");
    return;
  }

  await loadGameState();
}

// USE THIS
async function randomize() {
  const playersEl = document.getElementById("players");

  // Get REAL state once
  const res = await fetch("/api/state");
  const data = await res.json();

  const names = data.players.map(p => p.name);
  if (names.length < 2) return;

  // Cache original DOM rows & their real names
  const rows = Array.from(playersEl.children);
  const originalNames = rows.map(row =>
    row.querySelector("span").textContent
  );

  let tick = 0;
  let delay = 40;
  const maxTicks = 28;

  function spin() {
    rows.forEach(row => {
      const span = row.querySelector("span");
      span.textContent =
        names[Math.floor(Math.random() * names.length)];
    });

    tick++;
    delay += 12;

    if (tick < maxTicks) {
      setTimeout(spin, delay);
    } else {
      finish();
    }
  }




  async function finish() {
    // Restore original names BEFORE real shuffle
    rows.forEach((row, i) => {
      row.querySelector("span").textContent = originalNames[i];
    });

    await fetch("/api/players/randomize", { method: "POST" });

    // Reload from server (authoritative state)
    load();
  }

  spin();
}


async function loadKnownPlayers() {
  const knownEl = document.getElementById("known");
  const res = await fetch("/api/known");
  const data = await res.json();

  const stateRes = await fetch("/api/state");
  const state = await stateRes.json();

  const selected = new Set(state.players.map(p => p.name));

  knownEl.innerHTML = "";

  data.knownPlayers.forEach(name => {
    const div = document.createElement("div");
    div.className = "known-player";
    div.textContent = name;

    if (selected.has(name)) {
      div.style.opacity = "0.4";
    } else {
      div.onclick = async () => {
        await fetch("/api/players/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
        load();
        loadKnownPlayers();
      };
    }

    knownEl.appendChild(div);
  });
}

function startGame() {
  window.location.href = "/game.html";
}

load();
loadKnownPlayers();
