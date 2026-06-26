import { Router } from 'express';

import {
  createTask,
  deleteTask,
  disableExamMode,
  enableExamMode,
  listTasks,
  snoozeTask,
  sortTasksByPriority,
  updateTask
} from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';

const taskRoutes = Router();

taskRoutes.use(requireAuth);

taskRoutes.get('/', listTasks);
taskRoutes.post('/', createTask);
taskRoutes.post('/sort-by-priority', sortTasksByPriority);
taskRoutes.post('/exam-mode/enable', enableExamMode);
taskRoutes.post('/exam-mode/disable', disableExamMode);
taskRoutes.patch('/:id', updateTask);
taskRoutes.post('/:id/snooze', snoozeTask);
taskRoutes.delete('/:id', deleteTask);

export default taskRoutes;
