// Scheduler: checks every minute for due schedule automations and runs them.
// Times are interpreted in Asia/Karachi (UTC+5) as labelled in the UI.
const { db, save } = require('./db');
const { runAutomation } = require('./engine');

function karachiNow() {
  // Shift UTC by +5h and read the wall-clock fields from that Date.
  return new Date(Date.now() + 5 * 3600 * 1000);
}
function computeNextRun(automation, from) {
  const cfg = (automation.trigger && automation.trigger.config) || {};
  if (!cfg.time) return null;
  const [h, m] = cfg.time.split(':').map((n) => parseInt(n, 10));
  const base = from ? new Date(from) : karachiNow();
  // Build "today at time" in Karachi wall-clock, expressed back in UTC ms.
  const candidate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h - 5, m, 0));
  if (candidate.getTime() <= Date.now()) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString();
}

async function schedulerTick() {
  const ran = [];
  const nowK = karachiNow();
  const hhmm = String(nowK.getUTCHours()).padStart(2, '0') + ':' + String(nowK.getUTCMinutes()).padStart(2, '0');
  for (const automation of db.automations) {
    if (automation.status !== 'active') continue;
    if (!automation.trigger || automation.trigger.type !== 'schedule') continue;
    const cfg = automation.trigger.config || {};
    automation.nextRun = computeNextRun(automation);
    const dueByNextRun = automation._dueAt && new Date(automation._dueAt).getTime() <= Date.now();
    const dueByClock = cfg.time === hhmm && (!automation.lastRun || new Date(automation.lastRun).getTime() < Date.now() - 60000);
    if (dueByNextRun || dueByClock) {
      automation._dueAt = null;
      const exec = await runAutomation(automation, { scheduled: true, at: new Date().toISOString() }, automation.trigger);
      ran.push({ automationId: automation.id, executionId: exec.id, status: exec.status });
      automation.nextRun = computeNextRun(automation);
    }
  }
  save();
  return ran;
}

function startScheduler() {
  setInterval(() => { schedulerTick().catch((e) => console.error('Scheduler error:', e.message)); }, 60000);
}

module.exports = { schedulerTick, computeNextRun, startScheduler };
