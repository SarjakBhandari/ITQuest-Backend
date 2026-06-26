import { User } from '../models/User.js';

export async function promoteAdminFromEnv() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return;

  const user = await User.findOne({ email: adminEmail });
  if (!user) {
    console.log(`[admin] ADMIN_EMAIL "${adminEmail}" has no matching account yet - it will be promoted once registered.`);
    return;
  }

  if (!user.isAdmin) {
    user.isAdmin = true;
    await user.save();
    console.log(`[admin] Promoted ${adminEmail} to administrator.`);
  }
}
