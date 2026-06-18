const XP_PER_LEVEL = 500;
const DAILY_LOGIN_XP = 10;

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

export function applyDailyLogin(user) {
  const now = new Date();

  if (!user.lastLoginAt) {
    user.streak = 1;
    user.xp += DAILY_LOGIN_XP;
    user.lastLoginAt = now;
    return;
  }

  const gap = daysBetween(user.lastLoginAt, now);

  if (gap === 0) {
    return;
  }

  if (gap === 1) {
    user.streak += 1;
    user.xp += DAILY_LOGIN_XP;
  } else if (gap === 2 && user.freezesAvailable > 0) {
    user.freezesAvailable -= 1;
    user.xp += DAILY_LOGIN_XP;
  } else {
    user.streak = 1;
    user.xp += DAILY_LOGIN_XP;
  }

  user.lastLoginAt = now;
}

export { XP_PER_LEVEL, DAILY_LOGIN_XP };
