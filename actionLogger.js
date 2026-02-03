// actionLogger.js

const { sendHAEvent } = require("./haClient");

let currentGameId = null;
let sequence = 0;

 console.log("📝 logAction CALLED");

function startNewGame(gameId) {
  console.log("Starting new game. Logging");
  
  currentGameId = gameId;
  sequence = 0;
}



function logAction({ player, action }) {
  
  console.log("📝 logAction CALLED", action, player.name);
  // if (!currentGameId) return;

  const entry = {
    game_id: currentGameId,
    seq: ++sequence,
    timestamp: Date.now(),

    player_id: player.id,
    player_name: player.name,
    action
  };

  console.log("TEST!!");
  console.log("------");
  console.log("📤 HA payload:", JSON.stringify(entry));

  sendHAEvent("killer_pool_action", entry);
}

module.exports = {
  startNewGame,
  logAction
};
