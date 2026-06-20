const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOTPEmail(email, otp, subject = "Your Verification Code") {
    try {
      const otpDigits = otp
        .toString()
        .split("")
        .map(
          (d) => `
          <td style="padding: 0 4px;">
            <div style="
              width: 40px; height: 48px;
              background: #ffffff;
              border: 1.5px solid #ed9329;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
              font-weight: 600;
              color: #ed9329;
              font-family: 'Courier New', monospace;
              text-align: center;
              line-height: 48px;
            ">${d}</div>
          </td>`
        )
        .join("");

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; border: 1px solid #e5e7eb;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px; background:#ed9329;"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px;">
              <img
                src="${process.env.LOGO_URL || "https://yourdomain.com/logo.png"}"
                alt="MIVA Prestige"
                width="180"
                style="display:block; max-width:180px; height:auto;"
              />
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height:1px; background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="margin:0 0 6px; font-size:14px; color:#6b7280;">Hello,</p>
              <h1 style="margin:0 0 16px; font-size:20px; font-weight:600; color:#111827;">
                Here's your verification code
              </h1>
              <p style="margin:0 0 24px; font-size:14px; color:#6b7280; line-height:1.6;">
                Use the code below to verify your identity. This code is valid for <strong style="color:#111827;">10 minutes</strong> and can only be used once.
              </p>

              <!-- OTP Label -->
              <p style="margin:0 0 10px; font-size:11px; color:#9ca3af; text-align:center; letter-spacing:1.5px; text-transform:uppercase;">
                One-time passcode
              </p>

              <!-- OTP Digits Box -->
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:20px; text-align:center;">
                <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                  <tr>${otpDigits}</tr>
                </table>
              </div>

              <!-- Expiry note -->
              <p style="margin:12px 0 0; font-size:12px; color:#9ca3af; text-align:center;">
                &#9719; Expires in 10 minutes
              </p>

              <!-- Divider -->
              <div style="height:1px; background:#f3f4f6; margin:24px 0;"></div>

              <!-- Warning box -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px; vertical-align:top; padding-top:1px;">
                          <span style="font-size:14px;">⚠️</span>
                        </td>
                        <td style="font-size:12px; color:#92400e; line-height:1.6;">
                          If you didn't request this code, you can safely ignore this email.
                          <strong>Never share this code with anyone</strong>, including MIVA Prestige support.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #f3f4f6; padding:20px 32px; text-align:center;">
              <p style="margin:0 0 4px; font-size:11px; color:#9ca3af;">
                © ${new Date().getFullYear()} MIVA Prestige Ent. All rights reserved.
              </p>
              <p style="margin:0; font-size:11px; color:#d1d5db;">
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `;

      const mailOptions = {
        from: process.env.SMTP_FROM || "MIVA Prestige <noreply@mivaprestige.com>",
        to: email,
        subject,
        html: htmlContent,
        text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      // console.log(`OTP email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();