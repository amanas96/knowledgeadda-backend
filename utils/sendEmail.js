/**
 * MOCK Email Sending Function
 * In production, this would use a real service (like SendGrid or Nodemailer).
 * For now, it just logs the reset link to the console so you can test it.
 */
export const sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = "KnowledgeAdda: Password Reset Request";
  const text = `
    You are receiving this email because you (or someone else) have requested the reset of the password for your account.
    Please click on the following link, or paste this into your browser to complete the process:
    
    ${resetUrl}
    
    This link is valid for 10 minutes.
    If you did not request this, please ignore this email and your password will remain unchanged.
  `;

  console.log("====================================");
  console.log("   --- MOCK EMAIL SENT ---");
  console.log(` To: ${email}`);
  console.log(` Subject: ${subject}`);
  console.log(` Body: ${text}`);
  console.log("====================================");

  // In a real app, you would have:
  // await sendgrid.send({ to: email, from: '...', subject, text });
};
