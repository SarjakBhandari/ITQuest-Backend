export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getOtpExpiryDate() {
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES ?? 10);
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

export function sanitizeUser(user) {
  return {
    heroName: user.heroName,
    email: user.email,
    xp: user.xp ?? 0,
    streak: user.streak ?? 0,
    freezesAvailable: user.freezesAvailable ?? 0,
    isAdmin: Boolean(user.isAdmin)
  };
}
