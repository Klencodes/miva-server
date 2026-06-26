// services/otpService.js
const crypto = require("crypto");
const OTP = require("../models/OTP");
const EmailService = require("./Email");

class OTPService {
  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send OTP email
   */
  async sendOTP(email, type = "verification", req = null) {
    // Generate OTP
    const otp = this.generateOTP();

    // Set expiry (10 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete old OTPs for this email and type
    await OTP.deleteMany({
      email: email.toLowerCase(),
      type,
    });

    // Save OTP to database
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      otp,
      type,
      expires_at: expiresAt,
      metadata: {
        generated_at: new Date().toISOString(),
        ip: req?.ip || req?.connection?.remoteAddress || "unknown",
        user_agent: req?.headers?.["user-agent"] || "unknown",
      },
    });

    await otpRecord.save();

    // Send OTP via email
    const subject =
      type === "login"
        ? "Your Login Verification Code"
        : type === "password_reset"
          ? "Password Reset Code"
          : "Verify Your Email Address";

    const emailResult = await EmailService.sendOTPEmail(email, otp, subject);

    return {
      success: true,
      otp_id: otpRecord.uuid,
      expires_at: expiresAt,
      email_sent: emailResult.success,
    };
  }
// services/OTPService.js

/**
 * Verify OTP
 */
verifyOTP = async (email, otp, type = "verification") => {
  try {
    // Find the OTP
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
      type,
      expires_at: { $gt: new Date() },
      is_used: false, 
    });
    if (!otpRecord) {
      return {
        success: false,
        error: 'OTP_VERIFICATION_FAILED',
        message: 'Invalid or expired OTP'
      };
    }

    // Mark OTP as used
    otpRecord.is_used = true;
    
    if (type === "password_reset") {
      otpRecord.can_create_password = true;
    }
    
    await otpRecord.save();

    // 🔥 UPDATE USER VERIFIED STATUS
    if (type === "verification") {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && !user.verified) {
        user.verified = true;
        await user.save();
        console.log(`✅ User ${email} verified successfully`);
      }
    }

    return {
      success: true,
      message: 'OTP verified successfully'
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: 'OTP_VERIFICATION_FAILED',
      message: 'Failed to verify OTP'
    };
  }
};
/**
 * Resend OTP
 */
resendOTP = async (email, type = "verification", req) => {
  try {
    // Check if there's an existing OTP that hasn't expired
    const existingOTP = await OTP.findOne({
      email: email.toLowerCase(),
      type,
      expires_at: { $gt: new Date() },
      is_used: false,
    });

    // If there's a valid OTP that hasn't been used, don't allow resend
    if (existingOTP) {
      const waitSeconds = Math.ceil((existingOTP.expires_at - new Date()) / 1000);
      return {
        success: false,
        error: 'OTP_ALREADY_SENT',
        message: 'OTP already sent. Please wait before requesting a new one.',
        wait_seconds: Math.min(waitSeconds, 60),
        expires_at: existingOTP.expires_at,
      };
    }

    // Generate new OTP
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      type,
      expires_at: expiresAt,
      is_used: false,
      can_create_password: false, // Reset this flag for new OTPs
    });

    // Send OTP email
    const emailSent = await EmailService.sendOTPEmail(email, otp, type);

    return {
      success: true,
      message: 'OTP sent successfully',
      expires_at: expiresAt,
      email_sent: emailSent,
    };
  } catch (error) {
    console.error('Error resending OTP:', error);
    return {
      success: false,
      error: 'OTP_RESEND_FAILED',
      message: 'Failed to resend OTP'
    };
  }
};
}

module.exports = new OTPService();
