// config.js
require("dotenv").config();

module.exports = {
  homeAssistant: {
    url: process.env.HA_URL,
    token: process.env.HA_TOKEN
  }
};
