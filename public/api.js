// public/api.js
// Single source of truth for backend endpoints

export const API = {
  state: "/api/state",

  // game flow
  action: "/api/action",
  newGame: "/api/admin/newgame",

  // players
  addPlayer: "/api/players/add",
  removePlayer: "/api/players/remove",
  selectPlayer: "/api/players/select",

  // randomize
  slotRandomize: "/api/slotRandomize",
};

