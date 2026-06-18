const CATEGORY_WEIGHT = {
  Class: 1,
  Project: 1.15,
  Certs: 1.3,
  Exam: 1.4,
  Other: 0.9
};

const EARLY_COMPLETION_BONUS = 50;

export function calculateQuestXp({ hardness, category, days }) {
  const safeHardness = Math.min(10, Math.max(1, Number(hardness) || 1));
  const safeDays = Math.min(30, Math.max(0, Number(days) || 0));
  const categoryWeight = CATEGORY_WEIGHT[category] ?? 1;
  const daysFactor = 1 + (safeDays / 30) * 0.5;

  const rawXp = safeHardness * 30 * categoryWeight * daysFactor;
  return Math.min(1000, Math.round(rawXp / 10) * 10);
}

export function derivePriority(hardness) {
  const safeHardness = Math.min(10, Math.max(1, Number(hardness) || 1));
  if (safeHardness <= 3) return 'Low';
  if (safeHardness <= 7) return 'Medium';
  return 'High';
}

export { EARLY_COMPLETION_BONUS };
