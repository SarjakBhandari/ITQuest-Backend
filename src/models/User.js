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
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', userSchema);
