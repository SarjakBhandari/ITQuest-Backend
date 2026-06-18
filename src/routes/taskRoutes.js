import { Router } from 'express';

import { createTask, deleteTask, listTasks, updateTask } from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';

const taskRoutes = Router();

taskRoutes.use(requireAuth);

taskRoutes.get('/', listTasks);
taskRoutes.post('/', createTask);
taskRoutes.patch('/:id', updateTask);
taskRoutes.delete('/:id', deleteTask);

export default taskRoutes;
