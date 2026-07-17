const { Resend } = require("resend");

let resendClient = null;
function getResend() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}
const FROM_ADDRESS = process.env.EMAIL_FROM || "OS Reports <onboarding@resend.dev>";

async function sendMagicLink(email, link) {
  if (!process.env.RESEND_API_KEY) {
    // Local/dev fallback so you can test without an email provider configured
    console.log(`[dev] Magic link for ${email}: ${link}`);
    return;
  }
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Your OS Reports sign-in link",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#231F20;">Sign in to OS Reports</h2>
        <p>Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background:#FFB600;color:#231F20;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in</a>
        </p>
        <p style="color:#6B6663;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendMagicLink };
