import mongoose from 'mongoose';

import { GroupXpLog } from '../models/GroupXpLog.js';
import { Task, categoryValues, statusValues } from '../models/Task.js';
import {
  DAY_MS,
  EARLY_COMPLETION_BONUS,
  QUEST_COMPLETION_FREEZE_INTERVAL,
  calculateOverduePenalty,
  calculateQuestXp,
  calculateSnoozeXpCut,
  isTaskOverdue,
  withDerivedFields
} from '../utils/questXp.js';

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

function sanitizeTaskInput(body = {}, { partial } = { partial: false }) {
  const result = {};

  if (!partial || body.title !== undefined) {
    const title = body.title?.trim();
    if (!title) {
      throw validationError('Task title is required.');
    }
    if (title.length > 120) {
      throw validationError('Task title must be 120 characters or fewer.');
    }
    result.title = title;
  }

  if (body.description !== undefined) {
    result.description = String(body.description).trim().slice(0, 1000);
  }

  if (body.category !== undefined) {
    if (!categoryValues.includes(body.category)) {
      throw validationError(`Category must be one of: ${categoryValues.join(', ')}.`);
    }
    result.category = body.category;
  }

  if (!partial || body.hardness !== undefined) {
    const hardness = Number(body.hardness);
    if (!Number.isFinite(hardness) || hardness < 1 || hardness > 10) {
      throw validationError('Hardness must be a number between 1 and 10.');
    }
    result.hardness = Math.round(hardness);
  }

  if (!partial || body.days !== undefined) {
    if (body.days !== undefined) {
      const days = Number(body.days);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        throw validationError('Deadline must be between 1 and 365 days.');
      }
      result.days = Math.round(days);
    } else if (!partial) {
      throw validationError('Deadline (in days) is required.');
    }
  }

  if (body.note !== undefined) {
    result.note = String(body.note).trim().slice(0, 500);
  }

  if (body.status !== undefined) {
    if (!statusValues.includes(body.status)) {
      throw validationError(`Status must be one of: ${statusValues.join(', ')}.`);
    }
    result.status = body.status;
  }

  if (body.order !== undefined) {
    const order = Number(body.order);
    if (!Number.isFinite(order)) {
      throw validationError('Order must be a number.');
    }
    result.order = order;
  }

  return result;
}

async function applyOverduePenalties(tasks) {
  for (const task of tasks) {
    if (isTaskOverdue(task) && !task.overduePenaltyApplied) {
      const penalty = calculateOverduePenalty(task.xp);
      task.xp = Math.max(0, task.xp - penalty);
      task.overduePenaltyApplied = true;
      await task.save();
    }
  }
}

export async function listTasks(req, res, next) {
  try {
    const tasks = await Task.find({ owner: req.user._id }).sort({ status: 1, order: 1, createdAt: 1 });
    await applyOverduePenalties(tasks);
    res.status(200).json({
      ok: true,
      tasks: tasks.map(withDerivedFields),
      lastTouchedTaskId: req.user.lastTouchedTaskId ? req.user.lastTouchedTaskId.toString() : null
    });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req, res, next) {
  try {
    const data = sanitizeTaskInput(req.body, { partial: false });
    const { days, ...taskFields } = data;

    const category = taskFields.category ?? 'Other';
    taskFields.category = category;
    taskFields.xp = calculateQuestXp({ hardness: taskFields.hardness, category, days });
    taskFields.dueDate = new Date(Date.now() + days * DAY_MS);

    if (taskFields.order === undefined) {
      const lastInStatus = await Task.findOne({ owner: req.user._id, status: taskFields.status ?? 'backlog' }).sort({
        order: -1
      });
      taskFields.order = lastInStatus ? lastInStatus.order + 1 : 0;
    }

    const task = await Task.create({ ...taskFields, owner: req.user._id });

    req.user.lastQuestActivityAt = new Date();
    req.user.lastTouchedTaskId = task._id;
    await req.user.save();

    res.status(201).json({ ok: true, message: 'Quest created.', task: withDerivedFields(task) });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw notFoundError('Quest not found.');
    }

    const data = sanitizeTaskInput(req.body, { partial: true });
    const { days, ...rest } = data;

    const existing = await Task.findOne({ _id: req.params.id, owner: req.user._id });
    if (!existing) {
      throw notFoundError('Quest not found.');
    }

    if (existing.status === 'done' && rest.status !== undefined && rest.status !== 'done') {
      throw validationError("Completed quests can't be moved.");
    }

    const updates = { ...rest };

    const recalculatingDifficulty = updates.hardness !== undefined || updates.category !== undefined || days !== undefined;
    if (recalculatingDifficulty) {
      const hardness = updates.hardness ?? existing.hardness;
      const category = updates.category ?? existing.category;

      const effectiveDays =
        days !== undefined
          ? days
          : Math.max(0, Math.ceil((existing.dueDate.getTime() - Date.now()) / DAY_MS));
      updates.xp = calculateQuestXp({ hardness, category, days: effectiveDays });

      if (days !== undefined) {
        updates.dueDate = new Date(Date.now() + days * DAY_MS);
      }
    }

    const isPausing = updates.status === 'rest' && existing.status !== 'rest';
    const isResuming = existing.status === 'rest' && updates.status !== undefined && updates.status !== 'rest';

    if (isPausing) {
      updates.pausedAt = new Date();
    } else if (isResuming) {
      if (existing.pausedAt && existing.dueDate) {
        const pausedDurationMs = Date.now() - existing.pausedAt.getTime();
        updates.dueDate = new Date(existing.dueDate.getTime() + pausedDurationMs);
      }
      updates.pausedAt = null;
    }

    let earlyBonus = false;
    const isNewlyCompleted = updates.status === 'done' && existing.status !== 'done' && !existing.xpAwarded;
    if (isNewlyCompleted) {
      updates.xpAwarded = true;
      earlyBonus = Boolean(existing.dueDate && Date.now() <= existing.dueDate.getTime());
      const awardedXp = (updates.xp ?? existing.xp) + (earlyBonus ? EARLY_COMPLETION_BONUS : 0);
      req.user.xp += awardedXp;
      req.user.completedQuestsCount += 1;
      if (req.user.completedQuestsCount % QUEST_COMPLETION_FREEZE_INTERVAL === 0) {
        req.user.freezesAvailable += 1;
      }
    }

    req.user.lastQuestActivityAt = new Date();
    req.user.lastTouchedTaskId = existing._id;
    await req.user.save();

    if (isNewlyCompleted && req.user.group) {
      const awardedXp = (updates.xp ?? existing.xp) + (earlyBonus ? EARLY_COMPLETION_BONUS : 0);
      await GroupXpLog.create({ group: req.user.group, user: req.user._id, xp: awardedXp });
    }

    const task = await Task.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      ok: true,
      message: 'Quest updated.',
      task: withDerivedFields(task),
      earlyBonus,
      bonusXp: earlyBonus ? EARLY_COMPLETION_BONUS : 0
    });
  } catch (error) {
    next(error);
  }
}

export async function snoozeTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw notFoundError('Quest not found.');
    }

    const existing = await Task.findOne({ _id: req.params.id, owner: req.user._id });
    if (!existing) {
      throw notFoundError('Quest not found.');
    }

    if (existing.status === 'done') {
      throw validationError("Completed quests can't be snoozed.");
    }

    const cutXp = calculateSnoozeXpCut(existing.xp);
    const baseDueDate = existing.dueDate ? existing.dueDate.getTime() : Date.now();

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      {
        xp: Math.max(0, existing.xp - cutXp),
        dueDate: new Date(baseDueDate + DAY_MS),
        snoozeCount: existing.snoozeCount + 1,
        overduePenaltyApplied: false
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({ ok: true, message: 'Quest snoozed.', task: withDerivedFields(task), cutXp });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw notFoundError('Quest not found.');
    }

    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

    if (!task) {
      throw notFoundError('Quest not found.');
    }

    res.status(200).json({ ok: true, message: 'Quest deleted.' });
  } catch (error) {
    next(error);
  }
}
