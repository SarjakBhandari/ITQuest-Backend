import { STREAK_MILESTONES } from './achievements.js';

const XP_PER_LEVEL = 500;
const DAILY_LOGIN_XP = 10;
const STREAK_FREEZE_INTERVAL = 7;

export function getLevelProgress(totalXp) {
  const xp = Math.max(0, totalXp);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL };
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

function awardStreakFreezeIfEarned(user) {
  if (user.streak > 0 && user.streak % STREAK_FREEZE_INTERVAL === 0) {
    user.freezesAvailable += 1;
  }
}

export function applyDailyLogin(user) {
  const now = new Date();

  if (!user.lastLoginAt) {
    user.streak = 1;
    user.xp += DAILY_LOGIN_XP;
    user.lastLoginAt = now;
    return DAILY_LOGIN_XP;
  }

  const gap = daysBetween(user.lastLoginAt, now);

  if (gap === 0) {
    return 0;
  }

  if (gap === 1) {
    user.streak += 1;
    user.xp += DAILY_LOGIN_XP;
    awardStreakFreezeIfEarned(user);
  } else if (gap === 2 && user.freezesAvailable > 0) {
    user.freezesAvailable -= 1;
    user.xp += DAILY_LOGIN_XP;
  } else {
    user.streak = 1;
    user.xp += DAILY_LOGIN_XP;
  }

  user.lastLoginAt = now;
  return DAILY_LOGIN_XP;
}

export function claimStreakMilestoneRewards(user) {
  const claimed = user.claimedStreakMilestones ?? [];
  const newlyClaimed = [];

  for (const milestone of STREAK_MILESTONES) {
    if (user.streak >= milestone.days && !claimed.includes(milestone.days)) {
      user.xp += milestone.rewardXp;
      claimed.push(milestone.days);
      newlyClaimed.push(milestone);
    }
  }

  user.claimedStreakMilestones = claimed;
  return newlyClaimed;
}

export { XP_PER_LEVEL, DAILY_LOGIN_XP, STREAK_FREEZE_INTERVAL };
