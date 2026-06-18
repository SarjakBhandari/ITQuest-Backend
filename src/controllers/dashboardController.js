import { Task, categoryValues } from '../models/Task.js';
import { getLevelProgress } from '../utils/xp.js';

const priorityWeight = { High: 3, Medium: 2, Low: 1 };
const DAILY_LOGIN_XP = 10;

function daysUntil(date) {
  if (!date) return Infinity;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(date).getTime() - Date.now()) / msPerDay);
}

export async function getDashboardSummary(req, res, next) {
  try {
    const tasks = await Task.find({ owner: req.user._id });
    const activeTasks = tasks.filter((task) => task.status !== 'done');

    const overdueCount = activeTasks.filter((task) => daysUntil(task.dueDate) < 0).length;
    const dueSoonCount = activeTasks.filter((task) => {
      const days = daysUntil(task.dueDate);
      return days >= 0 && days <= 2;
    }).length;
    const otherActiveCount = activeTasks.length - overdueCount - dueSoonCount;

    const overloadPct = Math.min(
      100,
      Math.round(overdueCount * 20 + dueSoonCount * 10 + Math.max(otherActiveCount, 0) * 4)
    );

    const workloadCounts = categoryValues.reduce((acc, category) => ({ ...acc, [category]: 0 }), {});
    for (const task of activeTasks) {
      workloadCounts[task.category] += 1;
    }
    const workload = categoryValues
      .map((category) => ({
        category,
        pct: activeTasks.length ? Math.round((workloadCounts[category] / activeTasks.length) * 100) : 0
      }))
      .filter((segment) => segment.pct > 0);

    const priorityQuests = [...activeTasks]
      .sort((a, b) => {
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return daysUntil(a.dueDate) - daysUntil(b.dueDate);
      })
      .slice(0, 3)
      .map((task) => ({
        id: task._id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        xp: task.xp,
        dueDate: task.dueDate,
        status: task.status
      }));

    const weeklyXpPotential = activeTasks.reduce((sum, task) => sum + task.xp, 0) + DAILY_LOGIN_XP * 7;

    const { level, xpIntoLevel, xpForNextLevel } = getLevelProgress(req.user.xp);

    res.status(200).json({
      ok: true,
      summary: {
        level,
        xp: xpIntoLevel,
        xpForNextLevel,
        totalXp: req.user.xp,
        streak: req.user.streak,
        freezesAvailable: req.user.freezesAvailable,
        overloadPct,
        workload,
        priorityQuests,
        weeklyXpPotential
      }
    });
  } catch (error) {
    next(error);
  }
}
