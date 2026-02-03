const { homeAssistant } = require("./config");

async function sendHAEvent(eventType, payload) {
  if (!homeAssistant?.url || !homeAssistant?.token) {
    console.error("❌ Home Assistant config missing:", homeAssistant);
    return;
  }

  try {
    const res = await fetch(
      `${homeAssistant.url}/api/events/${eventType}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${homeAssistant.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    console.log("📡 HA response:", res.status);
  } catch (err) {
    console.error("❌ HA FETCH FAILED:", err);
  }
}

module.exports = { sendHAEvent };
