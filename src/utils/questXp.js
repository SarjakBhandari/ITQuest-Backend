const CATEGORY_WEIGHT = {
  Class: 1,
  Project: 1.15,
  Certs: 1.3,
  Exam: 1.4,
  Other: 0.9
};

const EARLY_COMPLETION_BONUS = 50;
const URGENT_THRESHOLD_DAYS = 1;
const SNOOZE_XP_CUT_RATIO = 0.15;
const SNOOZE_MIN_XP = 10;
const OVERDUE_PENALTY_RATIO = 0.2;
const QUEST_COMPLETION_FREEZE_INTERVAL = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateQuestXp({ hardness, category, days }) {
  const safeHardness = Math.min(10, Math.max(1, Number(hardness) || 1));
  const safeDays = Math.min(30, Math.max(0, Number(days) || 0));
  const categoryWeight = CATEGORY_WEIGHT[category] ?? 1;
  const daysFactor = 1 + (safeDays / 30) * 0.5;

  const rawXp = safeHardness * 30 * categoryWeight * daysFactor;
  return Math.min(1000, Math.round(rawXp / 10) * 10);
}

function hardnessPriority(hardness) {
  const safeHardness = Math.min(10, Math.max(1, Number(hardness) || 1));
  if (safeHardness <= 3) return 'Low';
  if (safeHardness <= 7) return 'Medium';
  return 'High';
}

// Urgency from an approaching/passed deadline overrides the hardness-based priority,
// since a task due tomorrow is urgent regardless of how "hard" it is.
export function derivePriority(hardness, dueDate, status) {
  if (status === 'done' || !dueDate) {
    return hardnessPriority(hardness);
  }

  const daysRemaining = (new Date(dueDate).getTime() - Date.now()) / DAY_MS;
  if (daysRemaining <= URGENT_THRESHOLD_DAYS) {
    return 'High';
  }

  return hardnessPriority(hardness);
}

export function isTaskOverdue(task) {
  return Boolean(task.dueDate) && task.status !== 'done' && new Date(task.dueDate).getTime() < Date.now();
}

export function calculateSnoozeXpCut(currentXp) {
  return Math.max(SNOOZE_MIN_XP, Math.round((currentXp * SNOOZE_XP_CUT_RATIO) / 10) * 10);
}

export function calculateOverduePenalty(currentXp) {
  return Math.round((currentXp * OVERDUE_PENALTY_RATIO) / 10) * 10;
}

// Read-time view of a task with priority/overdue recomputed against "now" —
// these reflect the passage of time and shouldn't require an explicit edit to update.
export function withDerivedFields(task) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  return {
    ...plain,
    priority: derivePriority(plain.hardness, plain.dueDate, plain.status),
    isOverdue: isTaskOverdue(plain)
  };
}

export {
  EARLY_COMPLETION_BONUS,
  URGENT_THRESHOLD_DAYS,
  QUEST_COMPLETION_FREEZE_INTERVAL,
  DAY_MS
};
