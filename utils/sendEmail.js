import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// ─── Reusable transporter ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Verify connection on startup ─────────────────────────────────────────────
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Email transporter ready");
  }
});

// ─── Password Reset Email ─────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "KnowledgeAdda — Reset Your Password",
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 0;">
                <table width="600" cellpadding="0" cellspacing="0"
                  style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px;text-align:center;">
                      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">
                        KnowledgeAdda
                      </h1>
                      <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px;">
                        Your Learning Partner
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 32px;">
                      <h2 style="color:#1e293b;font-size:20px;margin:0 0 12px;">
                        Reset Your Password
                      </h2>
                      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        We received a request to reset your password. Click the button below to create a new password.
                        This link is valid for <strong>10 minutes</strong>.
                      </p>

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding:8px 0 32px;">
                            <a href="${resetUrl}"
                              style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">
                              Reset My Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Fallback URL -->
                      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 8px;">
                        If the button doesn't work, copy and paste this link into your browser:
                      </p>
                      <p style="word-break:break-all;font-size:12px;color:#2563eb;margin:0 0 24px;">
                        ${resetUrl}
                      </p>

                      <!-- Warning -->
                      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 16px;">
                        <p style="color:#854d0e;font-size:13px;margin:0;">
                          ⚠️ If you did not request a password reset, please ignore this email.
                          Your password will remain unchanged.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
                      <p style="color:#94a3b8;font-size:12px;margin:0;">
                        © ${new Date().getFullYear()} KnowledgeAdda. All rights reserved.
                      </p>
                      <p style="color:#94a3b8;font-size:12px;margin:6px 0 0;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Password reset email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    return false;
  }
};
