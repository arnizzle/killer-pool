const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

/* ======================
   STATE
====================== */

let selectedPlayers = [];
let gameStarted = false;
let currentIndex = 0;
let winner = null;
let gameOver = false;

const KNOWN_PLAYERS_FILE = "./players.json";

function readKnownPlayersFromDisk() {
  try {
    if (!fs.existsSync(KNOWN_PLAYERS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(KNOWN_PLAYERS_FILE, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn("⚠️ knownPlayers.json is not an array");
      return [];
    }

    return data;
  } catch (err) {
    console.error("❌ Failed to read known players:", err);
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
   API ROUTES (FIRST)
====================== */

/* ======================
   API ROUTES — MUST BE FIRST
====================== */
app.post("/api/players/remove", (req, res) => {
  const { id } = req.body;

  selectedPlayers = selectedPlayers.filter(p => p.id !== id);

  // keep currentIndex sane
  if (currentIndex >= selectedPlayers.length) {
    currentIndex = 0;
  }

  res.json({ ok: true });
});


app.get("/api/state", (req, res) => {
  res.json({
    players: selectedPlayers,
    gameStarted,
    gameOver,
    currentPlayer:
      selectedPlayers[currentIndex] && !gameOver
        ? selectedPlayers[currentIndex].name
        : null,
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

/* ======================
   STATIC FILES
====================== */

app.use(express.static("public"));

/* ======================
   SPA FALLBACK — LAST
====================== */

app.use((req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ======================
   STATIC FILES (LAST)
====================== */

app.use(express.static("public"));

app.use((req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});


/* ======================
   START
====================== */

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
