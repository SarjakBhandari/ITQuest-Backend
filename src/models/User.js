import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    heroName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 24
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    xp: {
      type: Number,
      default: 0,
      min: 0
    },
    streak: {
      type: Number,
      default: 0,
      min: 0
    },
    freezesAvailable: {
      type: Number,
      default: 2,
      min: 0
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    completedQuestsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null
    },
    avatarColor: {
      type: String,
      default: null
    },
    theme: {
      type: String,
      default: 'violet'
    },
    maxActiveQuests: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    emailNudgesEnabled: {
      type: Boolean,
      default: true
    },
    lastNudgeEmailAt: {
      type: Date,
      default: null
    },
    lastQuestActivityAt: {
      type: Date,
      default: null
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    suspended: {
      type: Boolean,
      default: false
    },
    suspendedReason: {
      type: String,
      default: null
    },
    lastTouchedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    lastStreakReminderAt: {
      type: Date,
      default: null
    },
    weeklyXpTarget: {
      type: Number,
      default: 0,
      min: 0
    },
    claimedStreakMilestones: {
      type: [Number],
      default: []
    },
    examModeActive: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', userSchema);
