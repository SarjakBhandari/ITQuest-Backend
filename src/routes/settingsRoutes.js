import { Router } from 'express';

import { changePassword, getMySettings, updatePreferences, updateProfile } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

settingsRoutes.get('/me', getMySettings);
settingsRoutes.patch('/profile', updateProfile);
settingsRoutes.patch('/preferences', updatePreferences);
settingsRoutes.patch('/password', changePassword);

export default settingsRoutes;
