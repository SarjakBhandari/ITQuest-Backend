import bcrypt from 'bcryptjs';

import { PendingRegistration } from '../models/PendingRegistration.js';
import { User } from '../models/User.js';
import { sendOtpMail } from '../utils/mailer.js';
import { generateOtp, getOtpExpiryDate, sanitizeUser } from '../utils/otp.js';
import { COOKIE_NAME, getCookieOptions, signToken } from '../utils/jwt.js';
import { applyDailyLogin } from '../utils/xp.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export async function requestRegistrationOtp(req, res, next) {
  try {
    const { heroName, email, password } = req.body ?? {};

    if (!heroName?.trim() || !email?.trim() || !password) {
      throw validationError('Hero name, email, and password are required.');
    }

    if (heroName.trim().length < 3 || heroName.trim().length > 24) {
      throw validationError('Hero name must be between 3 and 24 characters.');
    }

    if (!emailPattern.test(email.trim())) {
      throw validationError('Enter a valid email address.');
    }

    if (password.length < 8) {
      throw validationError('Password must be at least 8 characters.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw validationError('An account with this email already exists.');
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const otp = generateOtp();
    const expiresAt = getOtpExpiryDate();

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        heroName: heroName.trim(),
        email: normalizedEmail,
        passwordHash,
        otp,
        expiresAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpMail({
      to: normalizedEmail,
      heroName: heroName.trim(),
      otp
    });

    res.status(200).json({
      ok: true,
      message: 'OTP sent to your email.'
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyRegistrationOtp(req, res, next) {
  try {
    const { email, code } = req.body ?? {};

    if (!email?.trim() || !code?.trim()) {
      throw validationError('Email and OTP code are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });

    if (!pending) {
      throw validationError('No OTP request found for that email.');
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      throw validationError('OTP has expired. Please request a new one.');
    }

    if (pending.otp !== code.trim()) {
      throw validationError('Invalid OTP. Please try again.');
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      throw validationError('An account with this email already exists.');
    }

    const user = await User.create({
      heroName: pending.heroName,
      email: pending.email,
      passwordHash: pending.passwordHash
    });

    await PendingRegistration.deleteOne({ email: normalizedEmail });

    res.status(200).json({
      ok: true,
      message: 'Registration completed.',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};

    if (!email?.trim() || !password) {
      throw validationError('Email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const error = new Error('No account found. Please register first.');
      error.statusCode = 401;
      throw error;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      const error = new Error('Incorrect email or password.');
      error.statusCode = 401;
      throw error;
    }

    applyDailyLogin(user);
    await user.save();

    const token = signToken({ sub: user._id.toString() });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(200).json({
      ok: true,
      message: 'Login successful.',
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, { ...getCookieOptions(), maxAge: undefined });
  res.status(200).json({ ok: true, message: 'Logged out.' });
}

export async function getCurrentUser(req, res) {
  res.status(200).json({ ok: true, message: 'Authenticated.', user: sanitizeUser(req.user) });
}
