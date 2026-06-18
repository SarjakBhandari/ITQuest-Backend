import { Router } from 'express';

import { getCurrentUser, login, logout, requestRegistrationOtp, verifyRegistrationOtp } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const authRoutes = Router();

authRoutes.post('/registration/request-otp', requestRegistrationOtp);
authRoutes.post('/registration/verify-otp', verifyRegistrationOtp);
authRoutes.post('/login', login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, getCurrentUser);

export default authRoutes;
