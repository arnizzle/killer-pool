let teleportPendingId = null;
let teleportQueue = [];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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


async function newGame() {
  const passwordInput = document.getElementById("adminPassword");
  const password = passwordInput ? passwordInput.value : "";
  const gameId = `game_${Date.now()}`;

  startNewGame(gameId);
  
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

  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = "<em>No players selected</em>";
    teleportQueue.length = 0;
    return;
  }

  // Snapshot teleport order once
  const teleportSnapshot = [...teleportQueue];

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player selected";
    div.dataset.id = p.id;

    // Teleport animation (if queued)
    const idx = teleportSnapshot.indexOf(p.id);
    if (idx !== -1) {
      div.style.animationDelay = `${idx * 90}ms`;
      div.classList.add("teleport-in");
    }

    // Click the CHIP ITSELF to unselect
    div.onclick = () => removePlayer(p.id);

    // Name + emoji
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${p.emoji || ""} ${p.name}`;

    div.appendChild(name);
    container.appendChild(div);
  });

  // ✅ Clear teleport queue AFTER render
  teleportQueue.length = 0;
}

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

function flashFinalPlayers() {
  const players = document.querySelectorAll("#selected .player");

  players.forEach((player, index) => {
    setTimeout(() => {
      player.classList.add("final-reel-flash");

      setTimeout(() => {
        player.classList.remove("final-reel-flash");
      }, 600);
    }, index * 150); // 👈 delay per player landing
  });
}

async function finalizeRandomize() {
  // Commit real shuffle on server
  await fetch("/api/randomize", { method: "POST" });

  // Fetch authoritative state
  const res = await fetch("/api/state");
  const data = await res.json();

  // Render FINAL positions
  renderSelectedPlayers(data.players);

  // 💛 Flash ALL players in final position (staggered)
  requestAnimationFrame(() => {
    flashFinalPlayers();
  });
}

function finalGoldBlink() {
  const players = document.querySelectorAll("#selected .player");
  const blinkCount = 3;
  const blinkDuration = 600; // must match goldFlash duration
  const pauseBetween = 200;

  let currentBlink = 0;

  function blinkOnce() {
    // Add gold flash
    players.forEach(p => p.classList.add("final-reel-flash"));

    // Remove after animation
    setTimeout(() => {
      players.forEach(p => p.classList.remove("final-reel-flash"));
      currentBlink++;

      // Schedule next blink if needed
      if (currentBlink < blinkCount) {
        setTimeout(blinkOnce, pauseBetween);
      }
    }, blinkDuration);
  }

  blinkOnce();
}


async function slotRandomize() {
  const reels = Array.from(document.querySelectorAll("#selected .player"));
  if (!reels.length) return;

  /* -------------------------
     1️⃣ START SPIN (visual only)
  ------------------------- */

  const names = reels.map(reel =>
    reel.querySelector(".player-name")?.textContent || ""
  );

  const intervals = reels.map(reel => {
    const nameEl = reel.querySelector(".player-name");
    return setInterval(() => {
      const r = Math.floor(Math.random() * names.length);
      nameEl.textContent = names[r];
    }, 80);
  });

  /* -------------------------
     2️⃣ GET FINAL ORDER (server truth)
  ------------------------- */

  await fetch("/api/randomize", { method: "POST" });
  const res = await fetch("/api/state");
  const data = await res.json();
  const finalPlayers = data.players;

  /* -------------------------
     3️⃣ LOCK REELS LEFT → RIGHT
  ------------------------- */

  reels.forEach((reel, index) => {
    const lockDelay = 900 + index * 700;

    setTimeout(() => {
      // Stop this reel
      clearInterval(intervals[index]);

      // Snap to final player
      const nameEl = reel.querySelector(".player-name");
      const final = finalPlayers[index];
      nameEl.textContent = `${final.emoji || ""} ${final.name}`;

      // 💛 Individual gold flash (EVERY reel)
      reel.classList.add("final-reel-flash");

      setTimeout(() => {
        reel.classList.remove("final-reel-flash");

        // ✨ ONLY AFTER LAST REEL'S FLASH FINISHES
        if (index === reels.length - 1) {
          setTimeout(() => {
            finalGoldBlink();
          }, 200); // small beat after last flash
        }

      }, 600); // MUST match goldFlash duration

    }, lockDelay);
  });
}
