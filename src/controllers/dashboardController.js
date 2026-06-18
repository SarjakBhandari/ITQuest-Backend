import { Task, categoryValues } from '../models/Task.js';
import { getLevelProgress, DAILY_LOGIN_XP } from '../utils/xp.js';
import { withDerivedFields } from '../utils/questXp.js';

const priorityWeight = { High: 3, Medium: 2, Low: 1 };
const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_QUEST_LIMIT = 4;
const ACTIVE_QUEST_LIMIT = 5;

// Backend mirror of the dashboard's Normal/Certs/Exam mode buttons: each mode
// narrows to its matching quest category (Normal stays unfiltered).
const MODE_CATEGORY_FILTER = {
  Certs: 'Certs',
  Exam: 'Exam'
};

function daysUntil(date) {
  if (!date) return Infinity;
  return Math.ceil((new Date(date).getTime() - Date.now()) / DAY_MS);
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfThisWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysLeftInWeek = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  return { daysLeftInWeek, endOfWeek: new Date(startOfDay(now).getTime() + daysLeftInWeek * DAY_MS) };
}

export async function getDashboardSummary(req, res, next) {
  try {
    const rawTasks = await Task.find({ owner: req.user._id });
    const tasks = rawTasks.map(withDerivedFields);

    const nonDoneTasks = tasks.filter((task) => task.status !== 'done');
    const inProgressTasks = tasks.filter((task) => task.status === 'in-progress');

    const overloadPct = Math.min(100, Math.round((inProgressTasks.length / ACTIVE_QUEST_LIMIT) * 100));

    const workloadCounts = categoryValues.reduce((acc, category) => ({ ...acc, [category]: 0 }), {});
    for (const task of inProgressTasks) {
      workloadCounts[task.category] += 1;
    }
    const workload = categoryValues
      .map((category) => ({
        category,
        pct: inProgressTasks.length ? Math.round((workloadCounts[category] / inProgressTasks.length) * 100) : 0
      }))
      .filter((segment) => segment.pct > 0);

    const modeCategory = MODE_CATEGORY_FILTER[req.query.mode];
    const priorityCandidates = modeCategory
      ? nonDoneTasks.filter((task) => task.category === modeCategory)
      : nonDoneTasks;

    const priorityQuests = [...priorityCandidates]
      .sort((a, b) => {
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return daysUntil(a.dueDate) - daysUntil(b.dueDate);
      })
      .slice(0, PRIORITY_QUEST_LIMIT)
      .map((task) => ({
        id: task._id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        xp: task.xp,
        dueDate: task.dueDate,
        status: task.status
      }));

    const { daysLeftInWeek, endOfWeek } = endOfThisWeek();
    const loginXpPotential = DAILY_LOGIN_XP * daysLeftInWeek;
    const taskXpPotential = nonDoneTasks
      .filter((task) => task.dueDate && new Date(task.dueDate) <= endOfWeek)
      .reduce((sum, task) => sum + task.xp, 0);
    const weeklyXpPotential = loginXpPotential + taskXpPotential;

    const { level, xpIntoLevel, xpForNextLevel } = getLevelProgress(req.user.xp);

    res.status(200).json({
      ok: true,
      summary: {
        heroName: req.user.heroName,
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
