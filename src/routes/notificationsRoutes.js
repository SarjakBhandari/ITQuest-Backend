import { Router } from 'express';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationsController.js';
import { requireAuth } from '../middleware/auth.js';

const notificationsRoutes = Router();

notificationsRoutes.use(requireAuth);

notificationsRoutes.get('/', listNotifications);
notificationsRoutes.post('/read-all', markAllNotificationsRead);
notificationsRoutes.patch('/:id/read', markNotificationRead);

export default notificationsRoutes;
