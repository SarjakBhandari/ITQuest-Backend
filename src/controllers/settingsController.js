import bcrypt from 'bcryptjs';

const AVATAR_COLORS = ['#a78bfa', '#facc15', '#23d97e', '#60a5fa', '#f87171', '#45dfa4', '#f97316', '#cebdff'];

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sanitizeSettings(user) {
  return {
    heroName: user.heroName,
    email: user.email,
    avatarColor: user.avatarColor,
    maxActiveQuests: user.maxActiveQuests,
    emailNudgesEnabled: user.emailNudgesEnabled
  };
}

export async function getMySettings(req, res, next) {
  try {
    res.status(200).json({ ok: true, settings: sanitizeSettings(req.user) });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { heroName, avatarColor } = req.body ?? {};

    if (heroName !== undefined) {
      const trimmed = heroName.trim();
      if (trimmed.length < 3 || trimmed.length > 24) {
        throw validationError('Hero name must be between 3 and 24 characters.');
      }
      req.user.heroName = trimmed;
    }

    if (avatarColor !== undefined) {
      if (avatarColor !== null && !AVATAR_COLORS.includes(avatarColor)) {
        throw validationError('Choose one of the provided avatar colors.');
      }
      req.user.avatarColor = avatarColor;
    }

    await req.user.save();
    res.status(200).json({ ok: true, message: 'Profile updated.', settings: sanitizeSettings(req.user) });
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const { maxActiveQuests, emailNudgesEnabled } = req.body ?? {};

    if (maxActiveQuests !== undefined) {
      const value = Number(maxActiveQuests);
      if (!Number.isFinite(value) || value < 1 || value > 20) {
        throw validationError('Max active quests must be a number between 1 and 20.');
      }
      req.user.maxActiveQuests = Math.round(value);
    }

    if (emailNudgesEnabled !== undefined) {
      req.user.emailNudgesEnabled = Boolean(emailNudgesEnabled);
    }

    await req.user.save();
    res.status(200).json({ ok: true, message: 'Preferences updated.', settings: sanitizeSettings(req.user) });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      throw validationError('Current and new password are required.');
    }

    if (newPassword.length < 8) {
      throw validationError('New password must be at least 8 characters.');
    }

    const matches = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!matches) {
      throw validationError('Current password is incorrect.');
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    req.user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await req.user.save();

    res.status(200).json({ ok: true, message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
}

export { AVATAR_COLORS };
