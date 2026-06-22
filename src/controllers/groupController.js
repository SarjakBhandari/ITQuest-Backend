import { Group } from '../models/Group.js';
import { GroupXpLog } from '../models/GroupXpLog.js';
import { User } from '../models/User.js';

const SEASON_NAMES = [
  'Season of Embers',
  'Season of Shadows',
  'Season of Frost',
  'Season of Storms',
  'Season of the Forge',
  'Season of Echoes',
  'Season of Wyrms',
  'Season of Stars',
  'Season of Rust',
  'Season of Tides'
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_MEMBERS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function randomCodePart(length) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${randomCodePart(3)}-${randomCodePart(4)}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Group.findOne({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique group code. Please try again.');
}

function getWeekStart(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diffToMonday);
  return result;
}

function getSeasonInfo(now = new Date()) {
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const firstJan = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.floor((weekStart.getTime() - getWeekStart(firstJan).getTime()) / (7 * DAY_MS));
  const name = SEASON_NAMES[((weekNumber % SEASON_NAMES.length) + SEASON_NAMES.length) % SEASON_NAMES.length];
  return { name, weekStart, weekEnd };
}

async function buildGroupPayload(group, currentUserId) {
  const { name: seasonName, weekStart, weekEnd } = getSeasonInfo();

  const members = await User.find({ _id: { $in: group.members } }).select('heroName avatarColor');

  const logs = await GroupXpLog.aggregate([
    { $match: { group: group._id, awardedAt: { $gte: weekStart, $lt: weekEnd } } },
    { $group: { _id: '$user', seasonXp: { $sum: '$xp' } } }
  ]);
  const seasonXpByUser = new Map(logs.map((entry) => [entry._id.toString(), entry.seasonXp]));

  const leaderboard = members
    .map((member) => ({
      id: member._id.toString(),
      heroName: member.heroName,
      avatarColor: member.avatarColor,
      seasonXp: seasonXpByUser.get(member._id.toString()) ?? 0,
      isYou: member._id.toString() === currentUserId.toString(),
      isOwner: member._id.toString() === group.owner.toString()
    }))
    .sort((a, b) => b.seasonXp - a.seasonXp || a.heroName.localeCompare(b.heroName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    id: group._id.toString(),
    name: group.name,
    code: group.code,
    ownerId: group.owner.toString(),
    memberCount: members.length,
    leaderboard,
    season: { name: seasonName, endsAt: weekEnd.toISOString() }
  };
}

export async function getMyGroup(req, res, next) {
  try {
    if (!req.user.group) {
      res.status(200).json({ ok: true, group: null });
      return;
    }

    const group = await Group.findById(req.user.group);
    if (!group) {
      req.user.group = null;
      await req.user.save();
      res.status(200).json({ ok: true, group: null });
      return;
    }

    const payload = await buildGroupPayload(group, req.user._id);
    res.status(200).json({ ok: true, group: payload });
  } catch (error) {
    next(error);
  }
}

export async function createGroup(req, res, next) {
  try {
    if (req.user.group) {
      throw validationError('Leave your current guild before creating a new one.');
    }

    const name = req.body?.name?.trim();
    if (!name || name.length < 3 || name.length > 40) {
      throw validationError('Guild name must be between 3 and 40 characters.');
    }

    const code = await generateUniqueCode();
    const group = await Group.create({ name, code, owner: req.user._id, members: [req.user._id] });

    req.user.group = group._id;
    await req.user.save();

    const payload = await buildGroupPayload(group, req.user._id);
    res.status(201).json({ ok: true, message: `"${group.name}" founded!`, group: payload });
  } catch (error) {
    next(error);
  }
}

export async function joinGroup(req, res, next) {
  try {
    if (req.user.group) {
      throw validationError('Leave your current guild before joining another.');
    }

    const code = req.body?.code?.trim().toUpperCase();
    if (!code) {
      throw validationError('Enter a group code.');
    }

    const group = await Group.findOne({ code });
    if (!group) {
      throw notFoundError('No guild found with that code.');
    }

    if (group.members.length >= MAX_MEMBERS) {
      throw validationError('This guild is full.');
    }

    group.members.push(req.user._id);
    await group.save();

    req.user.group = group._id;
    await req.user.save();

    const payload = await buildGroupPayload(group, req.user._id);
    res.status(200).json({ ok: true, message: `Joined "${group.name}"!`, group: payload });
  } catch (error) {
    next(error);
  }
}

export async function leaveGroup(req, res, next) {
  try {
    if (!req.user.group) {
      throw validationError('You are not in a guild.');
    }

    const group = await Group.findById(req.user.group);
    const groupId = req.user.group;

    req.user.group = null;
    await req.user.save();

    if (group) {
      group.members = group.members.filter((memberId) => memberId.toString() !== req.user._id.toString());

      if (group.members.length === 0) {
        await Group.deleteOne({ _id: group._id });
        await GroupXpLog.deleteMany({ group: groupId });
      } else {
        if (group.owner.toString() === req.user._id.toString()) {
          group.owner = group.members[0];
        }
        await group.save();
      }
    }

    res.status(200).json({ ok: true, message: 'You left the guild.' });
  } catch (error) {
    next(error);
  }
}
