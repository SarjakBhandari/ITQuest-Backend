import { Task } from '../models/Task.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getWeekStart(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diffToMonday);
  return result;
}

export async function getCurrentWeekXp(userId) {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

  const doneTasks = await Task.find({
    owner: userId,
    status: 'done',
    updatedAt: { $gte: weekStart, $lt: weekEnd }
  }).select('xp');

  return doneTasks.reduce((sum, task) => sum + task.xp, 0);
}
