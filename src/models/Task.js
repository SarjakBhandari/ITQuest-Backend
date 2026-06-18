import mongoose from 'mongoose';

const statusValues = ['backlog', 'in-progress', 'rest', 'done'];
const priorityValues = ['Low', 'Medium', 'High'];
const categoryValues = ['Class', 'Certs', 'Project', 'Exam', 'Other'];

const taskSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    category: {
      type: String,
      enum: categoryValues,
      default: 'Other'
    },
    priority: {
      type: String,
      enum: priorityValues,
      default: 'Low'
    },
    hardness: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    xp: {
      type: Number,
      min: 0,
      max: 1000,
      default: 100
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    dueDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: statusValues,
      default: 'backlog'
    },
    order: {
      type: Number,
      default: 0
    },
    xpAwarded: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ owner: 1, status: 1, order: 1 });

export const Task = mongoose.model('Task', taskSchema);
export { statusValues, priorityValues, categoryValues };
