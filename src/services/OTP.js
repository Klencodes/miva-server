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

  /**
   * Verify OTP
   */
  async verifyOTP(email, otp, type = "verification") {
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
      type,
      verified: false,
    }).sort({ created_at: -1 });

    if (!otpRecord) {
      return {
        success: false,
        error: "INVALID_OTP",
        message: "Invalid verification code",
      };
    }

    if (new Date() > otpRecord.expires_at) {
      return { success: false, error: "OTP_EXPIRED", message: "Code expired" };
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return {
        success: false,
        error: "OTP_ATTEMPTS_EXCEEDED",
        message: "Too many attempts",
      };
    }

    otpRecord.attempts += 1;
    await otpRecord.save();

    otpRecord.verified = true;
    await otpRecord.save();

    // Delete OTP after successful verification
    await OTP.deleteOne({ _id: otpRecord._id });

    return { success: true, message: "Verification successful" };
  }

  /**
   * Resend OTP
   */
  async resendOTP(email, type = "verification", req = null) {
    // Check if there's a recent OTP (within last 30 seconds)
    const recentOTP = await OTP.findOne({
      email: email.toLowerCase(),
      type,
      created_at: { $gte: new Date(Date.now() - 30 * 1000) },
    });

    if (recentOTP) {
      return {
        success: false,
        error: "TOO_FREQUENT",
        message: "Please wait 30 seconds before requesting a new code",
        wait_seconds: 30,
      };
    }

    // Send new OTP
    return await this.sendOTP(email, type, req);
  }
}

module.exports = new OTPService();
