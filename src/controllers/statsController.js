import { Task, categoryValues } from '../models/Task.js';
import { getLevelProgress } from '../utils/xp.js';
import { buildAchievements } from '../utils/achievements.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekStart(date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diffToMonday);
  return result;
}

function buildPersonalBest(doneTasks) {
  const weekTotals = new Map();
  for (const task of doneTasks) {
    const weekKey = getWeekStart(task.updatedAt).toISOString().slice(0, 10);
    weekTotals.set(weekKey, (weekTotals.get(weekKey) ?? 0) + task.xp);
  }

  const currentWeekKey = getWeekStart(new Date()).toISOString().slice(0, 10);
  const currentWeekXp = weekTotals.get(currentWeekKey) ?? 0;

  let bestWeekXp = 0;
  let bestWeekKey = null;
  for (const [weekKey, total] of weekTotals.entries()) {
    if (weekKey === currentWeekKey) continue;
    if (total > bestWeekXp) {
      bestWeekXp = total;
      bestWeekKey = weekKey;
    }
  }

  return {
    currentWeekXp,
    bestWeekXp,
    bestWeekLabel: bestWeekKey ? `Week of ${bestWeekKey}` : 'No prior weeks yet',
    delta: currentWeekXp - bestWeekXp,
    isNewBest: bestWeekKey !== null && currentWeekXp > bestWeekXp
  };
}

export async function getMyStats(req, res, next) {
  try {
    const tasks = await Task.find({ owner: req.user._id });
    const doneTasks = tasks.filter((task) => task.status === 'done');

    const statusBreakdown = { backlog: 0, 'in-progress': 0, rest: 0, done: 0 };
    for (const task of tasks) {
      statusBreakdown[task.status] += 1;
    }

    const priorityBreakdown = { High: 0, Medium: 0, Low: 0 };
    for (const task of tasks) {
      priorityBreakdown[task.priority] += 1;
    }

    const categoryMap = new Map(categoryValues.map((category) => [category, { category, count: 0, xp: 0 }]));
    for (const task of doneTasks) {
      const entry = categoryMap.get(task.category);
      entry.count += 1;
      entry.xp += task.xp;
    }
    const categoryBreakdown = [...categoryMap.values()].filter((entry) => entry.count > 0).sort((a, b) => b.xp - a.xp);
    const bestCategory = categoryBreakdown[0] ?? null;

    const today = startOfDay(new Date());
    const weeklyCompletions = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(today.getTime() - i * DAY_MS);
      const next = new Date(day.getTime() + DAY_MS);
      const count = doneTasks.filter((task) => task.updatedAt >= day && task.updatedAt < next).length;
      weeklyCompletions.push({ date: day.toISOString().slice(0, 10), count });
    }

    const { level, xpIntoLevel, xpForNextLevel } = getLevelProgress(req.user.xp);
    const achievements = buildAchievements(req.user, categoryBreakdown.length, level);

    res.status(200).json({
      ok: true,
      stats: {
        heroName: req.user.heroName,
        level,
        xp: xpIntoLevel,
        xpForNextLevel,
        totalXp: req.user.xp,
        streak: req.user.streak,
        freezesAvailable: req.user.freezesAvailable,
        completedQuestsCount: req.user.completedQuestsCount,
        statusBreakdown,
        priorityBreakdown,
        categoryBreakdown,
        bestCategory,
        weeklyCompletions,
        achievements
      }
    });
  } catch (error) {
    next(error);
  }
}
