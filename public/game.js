let pollInterval = null;
let celebrating = false;
const slammedPlayers = new Set();
const eliminatedAnimated = new Set();


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

async function loadGameState() {
  const res = await fetch("/api/state");
  const data = await res.json();

  renderPlayers(data.players);

  if (data.gameOver === true && data.winner && !celebrating) {
    console.log(data.players.name);
    console.log("🔥 CONDITION MATCHED — STARTING CELEBRATION");
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

function renderPlayers(players) {
  const container = document.getElementById("players");
  if (!container) {
    console.warn("❌ renderPlayers: #players not found");
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(players)) return;

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player";
    div.dataset.id = p.id;

    if (p.active) div.classList.add("active");
    if (p.eliminated) div.classList.add("eliminated");

    // Name + emoji
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${p.emoji || ""} ${p.name}`;

    // Hearts (3 lives)
    const hearts = document.createElement("span");
    hearts.className = "hearts";
    const remaining = Math.max(0, 3 - (p.misses || 0));
    hearts.textContent = "❤️".repeat(remaining);

    div.appendChild(name);
    div.appendChild(hearts);

    // ELIMINATED overlay (play ONCE)
    if (p.eliminated) {
      div.classList.add("crack");

      const label = document.createElement("div");
      label.className = "eliminated-label";
      label.textContent = "ELIMINATED";
      div.appendChild(label);

      if (!eliminatedAnimated.has(p.id)) {
        eliminatedAnimated.add(p.id);
        requestAnimationFrame(() => {
          label.classList.add("animate");
        });
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
