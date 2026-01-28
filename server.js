const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* ======================
   STATE
====================== */

let players = [];
let gameStarted = false;
let currentIndex = 0;
let winner = null; 
let gameOver = false;

/* ======================
   PASSWORD
====================== */

const { adminPassword } = JSON.parse(
  fs.readFileSync("./password.json", "utf8")
);

/* ======================
   KNOWN PLAYERS
====================== */

let knownPlayers = [];

function loadKnownPlayers() {
  try {
    const data = JSON.parse(fs.readFileSync("./players.json", "utf8"));
    knownPlayers = Array.isArray(data.knownPlayers)
      ? data.knownPlayers
      : [];
  } catch (err) {
    console.error("Failed to load players.json");
    knownPlayers = [];
  }
}

loadKnownPlayers();

/* ======================
   HELPERS
====================== */

function extractEmoji(name) {
  const match = name.match(/^\p{Emoji}/u);
  return match ? match[0] : "🏆";
}

function checkGameOver() {
  const alive = players.filter(p => !p.eliminated);

  setWinner({
    id: alive[0].id,
    name: alive[0].name,
    emoji: extractEmoji(alive[0].name)
  });

  if (alive.length === 1 && !gameOver) {
    gameOver = true;

    winner = {
      id: alive[0].id,
      name: alive[0].name,
      emoji: extractEmoji(alive[0].name)
    };
  }
}


function alivePlayers() {
  return players.filter(p => !p.eliminated);
}

function aliveCount() {
  return alivePlayers().length;
}

function advanceTurn() {
  if (aliveCount() <= 1) return;

  let next = currentIndex;

  do {
    next = (next + 1) % players.length;
  } while (players[next].eliminated);

  currentIndex = next;
}

/* ======================
   API
====================== */
function setWinner(obj) {
  if (typeof obj !== "object" || !obj.name) {
    throw new Error("❌ winner MUST be an object with a name");
  }
  winner = obj; 
}

app.post("/api/admin/newgame", (req, res) => {
  const { password } = req.body;

  if (password !== adminPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // 🔄 Reset game state ONLY (keep players)
  gameStarted = false;
  gameOver = false;
  // winner = null; FIX

  currentIndex = 0;

  players.forEach(p => {
    p.misses = 0;
    p.eliminated = false;
  });

  console.log("🔐 Admin started new game");

  res.json({ ok: true });
});

app.get("/api/known", (req, res) => {
  res.json({ knownPlayers });
});

app.get("/api/state", (req, res) => {
  res.json({
    players,
    gameStarted,
    currentPlayer: players[currentIndex]?.name || null,
    gameOver,
    winner
  });
});


app.post("/api/players/select", (req, res) => {
  if (gameStarted) return res.status(409).end();

  const { name } = req.body;
  if (!name) return res.status(400).end();

  if (players.find(p => p.name === name)) {
    return res.status(409).end();
  }

  players.push({
    id: uuidv4(),
    name,
    misses: 0,
    eliminated: false
  });

  res.json({ ok: true });
});

app.post("/api/players/remove", (req, res) => {
  if (gameStarted) return res.status(409).end();

  const { name } = req.body;
  players = players.filter(p => p.name !== name);

  if (currentIndex >= players.length) currentIndex = 0;

  res.json({ ok: true });
});

app.post("/api/slotRandomize", (req, res) => {
  if (gameStarted) {
    return res.status(409).json({ error: "Game already started" });
  }

  selectedPlayers = shuffle(selectedPlayers);
  res.json({ ok: true });
});

app.post("/api/randomize", (req, res) => {
  if (gameStarted) return res.status(409).end();

  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  res.json({ ok: true });
});

/* ======================
   GAME ACTIONS
====================== */

app.post("/api/action", (req, res) => {
  const { type } = req.body;

  if (!gameStarted) {
    gameStarted = true;
    currentIndex = players.findIndex(p => !p.eliminated);
  }

  const current = players[currentIndex];
  if (!current) return res.status(400).end();

  if (type === "miss") {
    current.misses += 1;
    if (current.misses >= 3) {
      current.eliminated = true;
    }
    checkGameOver();
  }

  // const alive = alivePlayers();
  // if (alive.length === 1) {
  //   console.log("Winner name:");
  //   console.log(alive[0].name);

  //   winner = alive[0].name;
  //   return res.json({ ok: true, winner });
  // }

  advanceTurn();
  res.json({ ok: true });
});

app.post("/api/admin/newgame", (req, res) => {
  players.forEach(p => {
    p.misses = 0;
    p.eliminated = false;
  });

  gameStarted = false;
  currentIndex = 0;
  winner = null;

  res.json({ ok: true });
});

/* ======================
   START
====================== */

app.listen(3000, () => {
  console.log("🚀 Killer Pool running on http://localhost:3000");
});
