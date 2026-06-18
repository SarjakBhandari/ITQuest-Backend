import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  return null;
}

export async function sendOtpMail({ to, heroName, otp }) {
  const siteName = process.env.SITE_NAME ?? 'IT Quest';
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[dev] OTP for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL ?? 'no-reply@itquest.local',
    to,
    subject: `${siteName} verification code`,
    text: `Hello ${heroName}, your verification code is ${otp}.`,
    html: `<p>Hello <strong>${heroName}</strong>,</p><p>Your verification code is <strong>${otp}</strong>.</p>`
  });
}
