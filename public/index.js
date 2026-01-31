let teleportPendingId = null;
let teleportQueue = [];


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
  // Pulse Start Game when ready
  const startBtn = document.querySelector(
    '.actions button[onclick="startGame()"]'
  );

  // Lock Randomize when game started
  const randWrap = document.getElementById("randomizeWrapper");

  if (randWrap) {
    if (data.gameStarted) {
      console.log("Locking");
      randWrap.classList.add("locked");
    } else {
      console.log("Locking");
      randWrap.classList.remove("locked");
    }
  }

  if (startBtn) {
    if (data.players.length >= 2 && !data.gameStarted) {
      startBtn.classList.add("pulse");
    } else {
      startBtn.classList.remove("pulse");
    }
  }

  document.body.classList.toggle("game-started", data.gameStarted);
}

const hint = document.createElement("div");
hint.textContent = "Click anywhere to continue";
hint.className = "click-hint";
document.body.appendChild(hint);

async function newGame() {
  const passwordInput = document.getElementById("adminPassword");
  const password = passwordInput ? passwordInput.value : "";

  const res = await fetch("/api/admin/newgame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ New game failed:", text);
    alert("Wrong password or request failed");
    return;
  }

  // Clear password field
  if (passwordInput) passwordInput.value = "";

  // Reload state
  await load();
}

function teleportKnownToSelected(playerId) {

  console.log("Teleporting");

  const knownEl = document.querySelector(`#known [data-id="${playerId}"]`);
  if (!knownEl) return;

  knownEl.classList.add("teleport-out");

  setTimeout(() => {
    const selectedEl = document.querySelector(`#selected [data-id="${playerId}"]`);
    if (selectedEl) {
      selectedEl.classList.add("teleport-in");
    }
  }, 350);
}

async function loadKnownPlayers() {
  console.log("Loadinging players");

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

    div.onclick = () => {
      const selectedContainer = document.getElementById("selected");
      if (selectedContainer) {

      }

      addKnownPlayer(p.id);
    };

    container.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 index.js DOM ready → calling load()");
  load();
  loadKnownPlayers();
});

function renderKnownPlayers(players) {
  const container = document.getElementById("known");
  if (!container) {
    console.warn("❌ renderKnownPlayers: #known not found");
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = "<em>No known players</em>";
    return;
  }

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player known";
    div.dataset.id = p.id; // REQUIRED for teleport + lookup

    // Name + emoji
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${p.emoji || ""} ${p.name}`;

    div.appendChild(name);

    // 👇 THIS IS THE MISSING PIECE
    div.onclick = () => {
      addKnownPlayer(p.id);
    };

    container.appendChild(div);
  });
}


async function addKnownPlayer(playerId) {
  teleportQueue.push(playerId);   // 👈 queue it (not overwrite)

  await fetch("/api/players/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: playerId })
  });

  await load();
}




// FIX

// async function addKnownPlayer(playerId) {
//   const res = await fetch("/api/players/select", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ id: playerId })
//   });

//   if (!res.ok) {
//     const text = await res.text();
//     console.error("❌ Failed to add known player:", text);
//     return;
//   }

//   // Refresh selected players
//   load();
// }

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
    teleportQueue.length = 0;
    return;
  }

  const teleportSnapshot = [...teleportQueue];

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player selected";
    div.dataset.id = p.id;

    const idx = teleportSnapshot.indexOf(p.id);
    if (idx !== -1) {
      div.style.animationDelay = `${idx * 90}ms`;
      div.classList.add("teleport-in");
    }

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

  teleportQueue.length = 0; // ✅ clear AFTER render

  container.innerHTML = "";

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = "<em>No players selected</em>";
    return;
  }

  players.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "player selected";
    div.dataset.id = p.id;

    // BURST TELEPORT
    const idx = teleportSnapshot.indexOf(p.id);
    if (idx !== -1) {
      div.style.animationDelay = `${idx * 90}ms`;
      div.classList.add("teleport-in");
    }

    // Clear queue AFTER rendering
    teleportQueue = [];
    teleportQueue.length = 0;


    // Name + emoji
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${p.emoji || ""} ${p.name}`;

    // Remove button (only if game not started)
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "✕";
    remove.onclick = () => removePlayer(p.id);

    div.appendChild(name);
    div.appendChild(remove);
    container.appendChild(div);
  });
}


// function renderSelectedPlayers(players) {
//   const container = document.getElementById("selected");
//   if (!container) {
//     console.warn("❌ renderSelectedPlayers: #selected not found");
//     return;
//   }

//   container.innerHTML = "";

//   if (!players.length) {
//     container.innerHTML = "<em>No players selected</em>";
//     return;
//   }

//   players.forEach(p => {
//     const div = document.createElement("div");
//     div.className = "player selected";

//     const name = document.createElement("span");
//     name.className = "player-name";
//     name.textContent = `${p.emoji || ""} ${p.name}`;

//     const remove = document.createElement("button");
//     remove.className = "remove";
//     remove.textContent = "✕";
//     remove.onclick = () => removePlayer(p.id);

//     div.appendChild(name);
//     div.appendChild(remove);
//     container.appendChild(div);
//   });
// }

async function startGame() {
  const res = await fetch("/api/game/start", {
    method: "POST"
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Start game failed:", text);
    return;
  }

  // Go to game screen
  window.location.href = "/game.html";
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

// function teleportChip(fromEl, toContainer) {
//   console.log("Chip");

//   const fromRect = fromEl.getBoundingClientRect();
//   const toRect = toContainer.getBoundingClientRect();

//   const clone = fromEl.cloneNode(true);
//   clone.classList.add("teleport-clone");

//   clone.style.left = `${fromRect.left}px`;
//   clone.style.top = `${fromRect.top}px`;
//   clone.style.width = `${fromRect.width}px`;
//   clone.style.height = `${fromRect.height}px`;

//   document.body.appendChild(clone);

//   // Force layout
//   clone.getBoundingClientRect();

//   // Move to center of target container
//   const targetX =
//     toRect.left + toRect.width / 2 - fromRect.width / 2;
//   const targetY =
//     toRect.top + toRect.height / 2 - fromRect.height / 2;

//   clone.style.transform = `translate(${targetX - fromRect.left}px, ${targetY - fromRect.top
//     }px) scale(1.2)`;
//   clone.style.opacity = "0";

//   setTimeout(() => clone.remove(), 500);
// }
