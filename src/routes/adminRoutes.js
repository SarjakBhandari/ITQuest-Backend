import { Router } from 'express';

import {
  createAnnouncement,
  deleteGuild,
  deleteUser,
  getGuild,
  getOverview,
  kickGuildMember,
  listAnnouncements,
  listGuilds,
  listUsers,
  renameGuild,
  setUserSuspension,
  updateUser
} from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get('/overview', getOverview);

adminRoutes.get('/users', listUsers);
adminRoutes.patch('/users/:id', updateUser);
adminRoutes.patch('/users/:id/suspension', setUserSuspension);
adminRoutes.delete('/users/:id', deleteUser);

adminRoutes.get('/guilds', listGuilds);
adminRoutes.get('/guilds/:id', getGuild);
adminRoutes.patch('/guilds/:id', renameGuild);
adminRoutes.delete('/guilds/:id', deleteGuild);
adminRoutes.delete('/guilds/:id/members/:memberId', kickGuildMember);

adminRoutes.get('/announcements', listAnnouncements);
adminRoutes.post('/announcements', createAnnouncement);

export default adminRoutes;
