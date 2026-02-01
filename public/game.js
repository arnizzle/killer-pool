const slammedPlayers = new Set();
const eliminatedAnimated = new Set();
const eliminationQueue = [];

let pollInterval = null;
let celebrating = false;
let finalEliminationPause = false;
let eliminationPlaying = false;
let currentPlayerId = null;


/* =========================================================
   LOAD GAME STATE
========================================================= */

let emojiRainRunning = false;

function startEmojiRain(emoji = "🎉", duration = 5000) {
  if (emojiRainRunning) return;
  emojiRainRunning = true;

  const interval = setInterval(() => {
    const el = document.createElement("div");
    el.className = "emoji-rain";
    el.textContent = emoji;

    el.style.left = Math.random() * 100 + "vw";
    el.style.fontSize = 1.5 + Math.random() * 2.5 + "rem";
    el.style.animationDuration = 2.5 + Math.random() * 2 + "s";

    document.body.appendChild(el);

    setTimeout(() => el.remove(), 6000);
  }, 120);
  return () => {
    clearInterval(interval);
    emojiRainRunning = false;
  };

}

async function playNextElimination() {
  if (eliminationPlaying) return;
  if (eliminationQueue.length === 0) return;

  eliminationPlaying = true;

  const player = eliminationQueue.shift();
  eliminatedAnimated.add(player.id);

  // Force re-render so crack animation applies
  renderPlayers(lastKnownPlayers);

  // Dramatic pause
  await new Promise(res => setTimeout(res, 900));

  eliminationPlaying = false;

  // Chain the next one
  playNextElimination();
}

async function loadGameState() {
  const res = await fetch("/api/state");
  const data = await res.json();

  // Update current player
  currentPlayerId = data.currentPlayerId;

  // Store + render players
  lastKnownPlayers = data.players;
  renderPlayers(data.players);

  // Play queued eliminations (if any)
  playNextElimination();

  const alivePlayers = data.players.filter(p => !p.eliminated);

  /* ---------------------------------
     FINAL ELIMINATION → CELEBRATION
  --------------------------------- */
  if (
    alivePlayers.length === 1 &&
    !finalEliminationPause &&
    !celebrating
  ) {
    finalEliminationPause = true;
    celebrating = true; // 🔒 hard lock to prevent double-fire

    // Stop polling so nothing interrupts celebration
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    console.log("💀 Final death pulse");
    document.body.classList.add("shake"); /// CHECK THIS

    // 🔴 RED SCREEN PULSE (ONCE)
    document.body.classList.add("final-death-pulse");

    // Clean up class after animation so it can never replay
    setTimeout(() => {
      document.body.classList.remove("final-death-pulse");
    }, 1300);

    console.log("⏸ Final elimination pause…");

    setTimeout(() => {
      console.log("🎉 Starting winner celebration");
      startCelebration(alivePlayers[0]);
    }, 1000);

    return;
  }

  /* ---------------------------------
     NON-FINAL GAME OVER (SAFETY NET)
  --------------------------------- */
  if (
    data.gameOver === true &&
    data.winner &&
    !celebrating
  ) {
    celebrating = true;

    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    console.log("🎉 Game over celebration");
    startCelebration(data.winner);
  }
}


async function sendAction(type) {
  console.log("🎯 Action:", type);

  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Action failed:", text);
    return;
  }

  await loadGameState();
}

function checkGameOverAfterAnimation() {
  if (!window.pendingGameOverState) return;

  // apply game-over UI ONLY after animation
  handleGameOver(window.pendingGameOverState);
  window.pendingGameOverState = null;
}


function renderPlayers(players) {
  const container = document.getElementById("players");
  if (!container) return;

  if (!Array.isArray(players)) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";

  players.forEach(player => {
    const div = document.createElement("div");
    div.classList.add("player");

    div.dataset.id = player.id;
    div.dataset.misses = player.misses ?? 0;

    /* -------------------------
       CURRENT PLAYER
    ------------------------- */
    if (String(player.id) === String(currentPlayerId)) {
      div.classList.add("current-player");
    }

    /* -------------------------
       NAME
    ------------------------- */
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${player.emoji || ""} ${player.name}`;

    /* -------------------------
       HEARTS
    ------------------------- */
    const hearts = document.createElement("span");
    hearts.className = "hearts";
    hearts.textContent = "❤️".repeat(Math.max(0, 3 - (player.misses || 0)));

    div.appendChild(name);
    div.appendChild(hearts);

    /* -------------------------
       ELIMINATION (TRANSITION-AWARE)
    ------------------------- */
    if (player.eliminated === true) {
      const label = document.createElement("div");
      label.className = "eliminated-label";
      label.textContent = "ELIMINATED";
      div.appendChild(label);

      // 🔥 ALWAYS allow animation if not yet animated
      if (!eliminatedAnimated.has(player.id)) {
        eliminatedAnimated.add(player.id);
        div.classList.add("eliminating");

        setTimeout(() => {
          div.classList.remove("eliminating");
          div.classList.add("eliminated");

          // 🧠 IMPORTANT: only now allow game-over UI
          checkGameOverAfterAnimation();
        }, 1300);
      } else {
        div.classList.add("eliminated");
      }
    }


    container.appendChild(div);
  });
}

/* =========================================================
   ACTIONS (HIT / MISS)
========================================================= */

async function hit() {
  if (celebrating) return;

  await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "hit" })
  });
}

async function miss() {
  if (celebrating) return;

  await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "miss" })
  });
}

/* =========================================================
   CELEBRATION (WINNER)
========================================================= */

function showWinner(winner) {
  const div = document.createElement("div");
  div.id = "win";
  div.textContent = `${winner.emoji || "🏆"} ${winner.name}`;
  document.body.appendChild(div);
}

function startCelebration(winner) {
  celebrating = true;

  const hint = document.createElement("div");
  hint.textContent = "Click anywhere to continue";
  hint.className = "click-hint";
  document.body.appendChild(hint);

  // stop polling
  if (pollInterval) clearInterval(pollInterval);

  // hide hit/miss buttons
  const controls = document.getElementById("controls");
  if (controls) controls.style.display = "none";

  const banner = document.createElement("div");
  banner.id = "winner-banner";

  const name = document.createElement("span");
  name.className = "winner-name";
  name.textContent = winner.name;

  banner.appendChild(name);
  document.body.appendChild(banner);

  startFireworks();
  const stopEmojiRain = startEmojiRain("🎉");

  function endCelebration() {
    celebrating = false;
    stopEmojiRain();
    window.location.href = "/";
  }

  document.addEventListener(
    "click",
    endCelebration,
    { once: true }
  );

}


/* =========================================================
   FIREWORKS
========================================================= */

function startFireworks() {
  const canvas = document.getElementById("fireworks");
  if (!canvas) {
    console.error("❌ Fireworks canvas not found");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("❌ Could not get canvas context");
    return;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  const particles = [];

  function spawnExplosion(x, y) {
    for (let i = 0; i < 120; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        life: 100
      });
    }
  }

  spawnExplosion(canvas.width / 2, canvas.height / 2);

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      ctx.fillStyle = `rgba(0,255,200,${p.life / 100})`;
      ctx.fillRect(p.x, p.y, 3, 3);
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (celebrating) {
      if (Math.random() < 0.08) {
        spawnExplosion(
          Math.random() * canvas.width,
          Math.random() * canvas.height * 0.6
        );
      }
      requestAnimationFrame(loop);
    }
  }

  loop();
}

/* =========================================================
   EMOJI EXPLOSION
========================================================= */

function explodeEmojis(emoji) {
  for (let i = 0; i < 100; i++) {
    const span = document.createElement("span");
    span.textContent = emoji;
    span.style.position = "fixed";
    span.style.left = Math.random() * 100 + "vw";
    span.style.top = Math.random() * 100 + "vh";
    span.style.fontSize = 20 + Math.random() * 40 + "px";
    span.style.animation = "emojiFall 5s linear forwards";

    el.style.setProperty("--drift", Math.random());

    document.body.appendChild(span);

    setTimeout(() => span.remove(), 5000);
  }
}

/* =========================================================
   START LOOP
========================================================= */
// Load immediately so players appear instantly
loadGameState();

// Then keep polling
pollInterval = setInterval(loadGameState, 1000);
