const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use("/public/", express.static(path.join(__dirname, "assets")));

/* ======================
   STATE
====================== */

let selectedPlayers = [];
let gameStarted = false;
let currentIndex = 0;
let winner = null;
let gameOver = false;

const KNOWN_PLAYERS_FILE = "./players.json";

/* ======================
   LOAD KNOWN PLAYERS
====================== */

function readKnownPlayersFromDisk() {
  try {
    if (!fs.existsSync(KNOWN_PLAYERS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(KNOWN_PLAYERS_FILE, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn("⚠️ players.json is not an array");
      return [];
    }

    return data;
  } catch (err) {
    console.error("❌ Failed to read players:", err);
    return [];
  }
}

/* ======================
   PASSWORD
====================== */

const { adminPassword } = JSON.parse(
  fs.readFileSync("./password.json", "utf8")
);

/* ======================
   HELPERS
====================== */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function extractEmoji(name) {
  const match = name.match(/^\p{Emoji}/u);
  return match ? match[0] : "🏆";
}

function alivePlayers() {
  return selectedPlayers.filter(p => !p.eliminated);
}

function aliveCount() {
  return alivePlayers().length;
}

function getCurrentPlayerId() {
  if (gameOver) return null;
  const player = selectedPlayers[currentIndex];
  return player ? player.id : null;
}

function checkGameOver() {
  const alive = alivePlayers();

  if (alive.length === 1 && !gameOver) {
    gameOver = true;
    winner = {
      id: alive[0].id,
      name: alive[0].name,
      emoji: extractEmoji(alive[0].name)
    };
  }
}

function advanceTurn() {
  if (aliveCount() <= 1) return;

  let next = currentIndex;

  do {
    next = (next + 1) % selectedPlayers.length;
  } while (selectedPlayers[next].eliminated);

  currentIndex = next;
}

/* ======================
   API ROUTES
====================== */

app.post("/api/players/remove", (req, res) => {
  const { id } = req.body;

  selectedPlayers = selectedPlayers.filter(p => p.id !== id);

  if (currentIndex >= selectedPlayers.length) {
    currentIndex = 0;
  }

  res.json({ ok: true });
});

app.post("/api/action", (req, res) => {
  if (!gameStarted || gameOver) {
    return res.status(409).send("Game not active");
  }

  const { type } = req.body;
  const player = selectedPlayers[currentIndex];

  if (!player || player.eliminated) {
    advanceTurn();
    return res.json({ ok: true });
  }

  if (type === "miss") {
    player.misses++;
    if (player.misses >= 3) {
      player.eliminated = true;
    }
  }

  checkGameOver();
  if (!gameOver) advanceTurn();

  res.json({ ok: true });
});

app.post("/api/admin/newgame", (req, res) => {
  const { password } = req.body;
  if (password !== adminPassword) {
    return res.status(403).send("Forbidden");
  }

  gameStarted = false;
  gameOver = false;
  currentIndex = 0;
  winner = null;

  selectedPlayers.forEach(p => {
    p.misses = 0;
    p.eliminated = false;
  });

  res.json({ ok: true });
});

app.post("/api/game/start", (req, res) => {
  if (selectedPlayers.length < 2) {
    return res.status(400).send("Need at least 2 players");
  }

  gameStarted = true;
  gameOver = false;
  currentIndex = 0;
  winner = null;

  selectedPlayers.forEach(p => {
    p.misses = 0;
    p.eliminated = false;
  });

  res.json({ ok: true });
});

/* ======================
   API STATE (MODIFIED)
====================== */

app.get("/api/state", (req, res) => {
  res.json({
    players: selectedPlayers,
    gameStarted,
    gameOver,

    // EXISTING FIELD (unchanged)
    currentPlayer:
      selectedPlayers[currentIndex] && !gameOver
        ? selectedPlayers[currentIndex].name
        : null,

    // ✅ ADDED FIELD
    currentPlayerId: getCurrentPlayerId(),

    winner: winner ? winner.name : null
  });
});

app.post("/api/players/select", (req, res) => {
  const { id } = req.body;

  const known = readKnownPlayersFromDisk();
  const player = known.find(p => p.id === id);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  if (selectedPlayers.some(p => p.id === id)) {
    return res.status(409).json({ error: "Already selected" });
  }

  selectedPlayers.push({
    ...player,
    misses: 0,
    eliminated: false
  });

  res.json({ ok: true });
});

app.get("/api/players/known", (req, res) => {
  res.json({ players: readKnownPlayersFromDisk() });
});

app.post("/api/players/randomize", (req, res) => {
  shuffle(selectedPlayers);
  currentIndex = 0;
  res.json({ ok: true });
});

/* ======================
   STATIC FILES
====================== */

app.use(express.static("public"));

app.use((req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ======================
   START SERVER
====================== */

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
