const { sendEmail, sendSMS } = require("./models/notifications");

const MIN_LEVEL = 20;
const MAX_DROP = 15;

module.exports.checkAndSendAlerts = async (
  tanks,
  meters,
  previousStates
) => {
  const alerts = [];

  for (const tank of tanks) {
    const id = tank.tankId;
    const level = tank.level;
    const prev = previousStates[`tank_${id}`];

    if (level < MIN_LEVEL) {
      const msg = `⚠️ Tank ${id} low: ${level}%`;
      await sendEmail("Low Tank", msg);
      await sendSMS(msg);
      alerts.push({ type: "low", msg });
    }

    if (prev !== undefined && prev - level > MAX_DROP) {
      const msg = `🚨 Leak on tank ${id}`;
      await sendEmail("Leak Alert", msg);
      await sendSMS(msg);
      alerts.push({ type: "leak", msg });
    }
  }

  return alerts;
};