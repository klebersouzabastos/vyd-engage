import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

const APP_NAME = 'VYD Engage';

function verifyTOTP(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export const twoFactorService = {
  /**
   * Generate a new TOTP secret and QR code for setup
   */
  async setup(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError('User not found', 404);

    if (user.twoFactorEnabled) {
      throw createError('2FA is already enabled', 400, 'TWO_FACTOR_ALREADY_ENABLED');
    }

    const secret = generateSecret();
    const otpauth = generateURI({ issuer: APP_NAME, label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Store secret temporarily (not enabled yet until verified)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl: otpauth,
    };
  },

  /**
   * Verify TOTP code and enable 2FA
   */
  async verifyAndEnable(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError('User not found', 404);

    if (!user.twoFactorSecret) {
      throw createError('2FA setup not initiated. Call setup first.', 400, 'TWO_FACTOR_NOT_SETUP');
    }

    if (user.twoFactorEnabled) {
      throw createError('2FA is already enabled', 400, 'TWO_FACTOR_ALREADY_ENABLED');
    }

    const isValid = verifyTOTP(code, user.twoFactorSecret);
    if (!isValid) {
      throw createError('Invalid verification code', 400, 'INVALID_TOTP_CODE');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { enabled: true };
  },

  /**
   * Validate a TOTP code during login
   */
  async validateCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return false;
    }

    return verifyTOTP(code, user.twoFactorSecret);
  },

  /**
   * Disable 2FA (requires valid TOTP code)
   */
  async disable(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError('User not found', 404);

    if (!user.twoFactorEnabled) {
      throw createError('2FA is not enabled', 400, 'TWO_FACTOR_NOT_ENABLED');
    }

    const isValid = verifyTOTP(code, user.twoFactorSecret!);
    if (!isValid) {
      throw createError('Invalid verification code', 400, 'INVALID_TOTP_CODE');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { disabled: true };
  },

  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return user?.twoFactorEnabled ?? false;
  },
};
