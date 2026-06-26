import { User } from '../models/User.js';
import { COOKIE_NAME, verifyToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      const error = new Error('You must be logged in to do that.');
      error.statusCode = 401;
      throw error;
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      const error = new Error('Session expired. Please log in again.');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      const error = new Error('Session expired. Please log in again.');
      error.statusCode = 401;
      throw error;
    }

    if (user.suspended) {
      const error = new Error(
        user.suspendedReason ? `Your account has been suspended: ${user.suspendedReason}` : 'Your account has been suspended.'
      );
      error.statusCode = 403;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    const error = new Error('Administrator access required.');
    error.statusCode = 403;
    next(error);
    return;
  }
  next();
}
