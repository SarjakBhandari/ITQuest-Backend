import mongoose from 'mongoose';

const groupXpLogSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  xp: {
    type: Number,
    required: true
  },
  awardedAt: {
    type: Date,
    default: Date.now
  }
});

export const GroupXpLog = mongoose.model('GroupXpLog', groupXpLogSchema);
