import { Router } from 'express';

import { getDashboardSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

dashboardRoutes.get('/summary', getDashboardSummary);

export default dashboardRoutes;
