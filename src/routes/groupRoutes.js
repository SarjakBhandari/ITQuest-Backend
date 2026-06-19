import { Router } from 'express';

import { createGroup, getMyGroup, joinGroup, leaveGroup } from '../controllers/groupController.js';
import { requireAuth } from '../middleware/auth.js';

const groupRoutes = Router();

groupRoutes.use(requireAuth);

groupRoutes.get('/me', getMyGroup);
groupRoutes.post('/', createGroup);
groupRoutes.post('/join', joinGroup);
groupRoutes.post('/leave', leaveGroup);

export default groupRoutes;
