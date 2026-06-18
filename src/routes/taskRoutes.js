import { Router } from 'express';

import { createTask, deleteTask, listTasks, snoozeTask, updateTask } from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';

const taskRoutes = Router();

taskRoutes.use(requireAuth);

taskRoutes.get('/', listTasks);
taskRoutes.post('/', createTask);
taskRoutes.patch('/:id', updateTask);
taskRoutes.post('/:id/snooze', snoozeTask);
taskRoutes.delete('/:id', deleteTask);

export default taskRoutes;
