import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    audience: {
      type: String,
      enum: ['all', 'user'],
      required: true
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    recipientCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const Announcement = mongoose.model('Announcement', announcementSchema);
