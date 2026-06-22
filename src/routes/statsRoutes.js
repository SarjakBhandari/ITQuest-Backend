import { Router } from 'express';

import { getMyStats } from '../controllers/statsController.js';
import { requireAuth } from '../middleware/auth.js';

const statsRoutes = Router();

statsRoutes.use(requireAuth);

statsRoutes.get('/me', getMyStats);

export default statsRoutes;
