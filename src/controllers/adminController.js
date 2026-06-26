import { Announcement } from '../models/Announcement.js';
import { Group } from '../models/Group.js';
import { GroupXpLog } from '../models/GroupXpLog.js';
import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';

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

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function sanitizeAdminUser(user) {
  return {
    id: user._id.toString(),
    heroName: user.heroName,
    email: user.email,
    xp: user.xp,
    streak: user.streak,
    freezesAvailable: user.freezesAvailable,
    maxActiveQuests: user.maxActiveQuests,
    completedQuestsCount: user.completedQuestsCount,
    isAdmin: user.isAdmin,
    suspended: user.suspended,
    suspendedReason: user.suspendedReason,
    hasGuild: Boolean(user.group),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

export async function getOverview(req, res, next) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [totalUsers, totalGuilds, totalQuestsCompleted, suspendedUsers, activeUsersLast7Days, xpAgg, users] =
      await Promise.all([
        User.countDocuments(),
        Group.countDocuments(),
        Task.countDocuments({ status: 'done' }),
        User.countDocuments({ suspended: true }),
        User.countDocuments({ lastLoginAt: { $gte: sevenDaysAgo } }),
        User.aggregate([{ $group: { _id: null, totalXp: { $sum: '$xp' } } }]),
        User.find({ createdAt: { $gte: sevenDaysAgo } }).select('createdAt')
      ]);

    const totalXpAwarded = xpAgg[0]?.totalXp ?? 0;

    const signupsByDay = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(startOfDay(now).getTime() - i * DAY_MS);
      const next = new Date(day.getTime() + DAY_MS);
      const count = users.filter((user) => user.createdAt >= day && user.createdAt < next).length;
      signupsByDay.push({ date: day.toISOString().slice(0, 10), count });
    }

    res.status(200).json({
      ok: true,
      overview: {
        totalUsers,
        totalGuilds,
        totalQuestsCompleted,
        suspendedUsers,
        activeUsersLast7Days,
        totalXpAwarded,
        signupsByDay
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const search = req.query.search?.trim();
    const filter = search
      ? { $or: [{ heroName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
      : {};

    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ ok: true, users: users.map(sanitizeAdminUser) });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw notFoundError('User not found.');

    const { xp, streak, freezesAvailable, maxActiveQuests, isAdmin } = req.body ?? {};

    if (xp !== undefined) {
      if (!Number.isFinite(Number(xp)) || Number(xp) < 0) throw validationError('XP must be a non-negative number.');
      user.xp = Math.round(Number(xp));
    }
    if (streak !== undefined) {
      if (!Number.isFinite(Number(streak)) || Number(streak) < 0) throw validationError('Streak must be a non-negative number.');
      user.streak = Math.round(Number(streak));
    }
    if (freezesAvailable !== undefined) {
      if (!Number.isFinite(Number(freezesAvailable)) || Number(freezesAvailable) < 0) {
        throw validationError('Freezes must be a non-negative number.');
      }
      user.freezesAvailable = Math.round(Number(freezesAvailable));
    }
    if (maxActiveQuests !== undefined) {
      const value = Number(maxActiveQuests);
      if (!Number.isFinite(value) || value < 1 || value > 20) {
        throw validationError('Max active quests must be between 1 and 20.');
      }
      user.maxActiveQuests = Math.round(value);
    }
    if (isAdmin !== undefined) {
      if (user._id.equals(req.user._id) && !isAdmin) {
        throw validationError('You cannot remove your own administrator access.');
      }
      user.isAdmin = Boolean(isAdmin);
    }

    await user.save();
    res.status(200).json({ ok: true, message: 'User updated.', user: sanitizeAdminUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function setUserSuspension(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw notFoundError('User not found.');

    if (user._id.equals(req.user._id)) {
      throw validationError('You cannot suspend your own account.');
    }

    const { suspended, reason } = req.body ?? {};
    user.suspended = Boolean(suspended);
    user.suspendedReason = user.suspended ? (reason?.trim() || null) : null;
    await user.save();

    res.status(200).json({
      ok: true,
      message: user.suspended ? 'User suspended.' : 'User reinstated.',
      user: sanitizeAdminUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw notFoundError('User not found.');

    if (user._id.equals(req.user._id)) {
      throw validationError('You cannot delete your own account.');
    }

    await Task.deleteMany({ owner: user._id });
    await Notification.deleteMany({ owner: user._id });

    if (user.group) {
      const group = await Group.findById(user.group);
      if (group) {
        group.members = group.members.filter((memberId) => !memberId.equals(user._id));
        if (group.members.length === 0) {
          await Group.deleteOne({ _id: group._id });
          await GroupXpLog.deleteMany({ group: group._id });
        } else {
          if (group.owner.equals(user._id)) {
            group.owner = group.members[0];
          }
          await group.save();
        }
      }
    }

    await User.deleteOne({ _id: user._id });
    res.status(200).json({ ok: true, message: 'User deleted.' });
  } catch (error) {
    next(error);
  }
}

export async function listGuilds(req, res, next) {
  try {
    const groups = await Group.find().sort({ createdAt: -1 }).limit(200);
    const ownerIds = groups.map((group) => group.owner);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('heroName');
    const ownerNameById = new Map(owners.map((owner) => [owner._id.toString(), owner.heroName]));

    res.status(200).json({
      ok: true,
      guilds: groups.map((group) => ({
        id: group._id.toString(),
        name: group.name,
        code: group.code,
        ownerName: ownerNameById.get(group.owner.toString()) ?? 'Unknown',
        memberCount: group.members.length,
        createdAt: group.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function getGuild(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw notFoundError('Guild not found.');

    const members = await User.find({ _id: { $in: group.members } }).select('heroName email xp');

    res.status(200).json({
      ok: true,
      guild: {
        id: group._id.toString(),
        name: group.name,
        code: group.code,
        ownerId: group.owner.toString(),
        createdAt: group.createdAt,
        members: members.map((member) => ({
          id: member._id.toString(),
          heroName: member.heroName,
          email: member.email,
          xp: member.xp,
          isOwner: member._id.equals(group.owner)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function renameGuild(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw notFoundError('Guild not found.');

    const name = req.body?.name?.trim();
    if (!name || name.length < 3 || name.length > 40) {
      throw validationError('Guild name must be between 3 and 40 characters.');
    }

    group.name = name;
    await group.save();
    res.status(200).json({ ok: true, message: 'Guild renamed.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteGuild(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw notFoundError('Guild not found.');

    await User.updateMany({ group: group._id }, { group: null });
    await GroupXpLog.deleteMany({ group: group._id });
    await Group.deleteOne({ _id: group._id });

    res.status(200).json({ ok: true, message: 'Guild disbanded.' });
  } catch (error) {
    next(error);
  }
}

export async function kickGuildMember(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw notFoundError('Guild not found.');

    const memberId = req.params.memberId;
    if (!group.members.some((id) => id.toString() === memberId)) {
      throw notFoundError('That member is not in this guild.');
    }

    group.members = group.members.filter((id) => id.toString() !== memberId);
    await User.updateOne({ _id: memberId }, { group: null });

    if (group.members.length === 0) {
      await Group.deleteOne({ _id: group._id });
      await GroupXpLog.deleteMany({ group: group._id });
    } else {
      if (group.owner.toString() === memberId) {
        group.owner = group.members[0];
      }
      await group.save();
    }

    res.status(200).json({ ok: true, message: 'Member removed from guild.' });
  } catch (error) {
    next(error);
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(50);
    res.status(200).json({
      ok: true,
      announcements: announcements.map((announcement) => ({
        id: announcement._id.toString(),
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience,
        recipientCount: announcement.recipientCount,
        createdAt: announcement.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const { title, body, audience, targetEmail } = req.body ?? {};

    const trimmedTitle = title?.trim();
    const trimmedBody = body?.trim();
    if (!trimmedTitle || trimmedTitle.length > 80) throw validationError('Title is required and must be 80 characters or fewer.');
    if (!trimmedBody || trimmedBody.length > 500) throw validationError('Message is required and must be 500 characters or fewer.');
    if (!['all', 'user'].includes(audience)) throw validationError('Audience must be "all" or "user".');

    let recipients = [];
    let targetUser = null;

    if (audience === 'all') {
      recipients = await User.find().select('_id');
    } else {
      const email = targetEmail?.trim().toLowerCase();
      if (!email) throw validationError('Enter the recipient email.');
      targetUser = await User.findOne({ email });
      if (!targetUser) throw notFoundError('No user found with that email.');
      recipients = [targetUser];
    }

    const announcement = await Announcement.create({
      title: trimmedTitle,
      body: trimmedBody,
      createdBy: req.user._id,
      audience,
      targetUser: targetUser?._id ?? null,
      recipientCount: recipients.length
    });

    await Notification.insertMany(
      recipients.map((recipient) => ({
        owner: recipient._id,
        type: 'announcement',
        icon: 'notifications',
        title: trimmedTitle,
        body: trimmedBody,
        dedupeKey: `announcement:${announcement._id.toString()}`,
        read: false
      }))
    );

    res.status(201).json({
      ok: true,
      message: `Announcement sent to ${recipients.length} user${recipients.length === 1 ? '' : 's'}.`,
      announcement: {
        id: announcement._id.toString(),
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience,
        recipientCount: announcement.recipientCount,
        createdAt: announcement.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}
