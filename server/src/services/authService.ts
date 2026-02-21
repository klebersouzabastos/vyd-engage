import prisma from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../utils/jwt.js';
import { createError } from '../middleware/errorHandler.js';
import { UserRole, UserStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { hashToken } from '../utils/tokenHash.js';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  companyName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string;
  };
  accessToken: string;
  refreshToken: string;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw createError('User with this email already exists', 400, 'USER_EXISTS');
  }

  // Create tenant
  const tenantSlug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Ensure unique slug
  let finalSlug = tenantSlug;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${tenantSlug}-${counter}`;
    counter++;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: data.companyName,
      slug: finalSlug,
    },
  });

  // Create user
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      tenantId: tenant.id,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: false, // Require email verification
    },
  });

  // Create default subscription (trial)
  const proPlan = await prisma.plan.findUnique({
    where: { type: 'PRO' },
  });

  if (proPlan) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: proPlan.id,
        status: 'TRIAL',
        billingCycle: 'MONTHLY',
        renewalDate: trialEndsAt,
        trialEndsAt,
      },
    });

    // Schedule billing job for trial end
    if (process.env.ENABLE_BILLING_JOBS === 'true') {
      try {
        const { scheduleBillingJob } = await import('../jobs/billing.js');
        await scheduleBillingJob(subscription.id, trialEndsAt);
      } catch (error) {
        // Log but don't fail registration
        logger.error('Failed to schedule billing job for new subscription', error);
      }
    }
  }

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    tenantId: tenant.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Save refresh token
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
    },
    accessToken,
    refreshToken,
  };
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isValidPassword = await comparePassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw createError('User account is not active', 403, 'USER_INACTIVE');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Save refresh token
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshToken(token: string): Promise<{ accessToken: string }> {
  // Verify refresh token
  const { verifyRefreshToken } = await import('../utils/jwt.js');
  const payload = verifyRefreshToken(token);

  // Check if refresh token exists in database
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });

  if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) {
    throw createError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Check if user is still active
  if (refreshTokenRecord.user.status !== 'ACTIVE') {
    throw createError('User account is not active', 403, 'USER_INACTIVE');
  }

  // Generate new access token
  const tokenPayload: TokenPayload = {
    userId: refreshTokenRecord.user.id,
    tenantId: refreshTokenRecord.user.tenantId,
    email: refreshTokenRecord.user.email,
    role: refreshTokenRecord.user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);

  return { accessToken };
}

export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Normalize email (trim and lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  logger.info('Password reset requested', { email: normalizedEmail });
  
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Don't reveal if user exists for security
    logger.info('User not found for password reset', { email: normalizedEmail });
    return;
  }
  
  logger.info('User found for password reset', { userId: user.id, email: user.email });

  // Generate reset token — store hash, send plaintext to user
  const resetToken = uuidv4();
  const resetTokenHash = hashToken(resetToken);
  const resetExpires = new Date();
  resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: resetExpires,
    },
  });

  // Send email
  const { sendEmail, emailTemplates } = await import('./emailService.js');
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
  try {
    logger.info('Attempting to send password reset email', { 
      userId: user.id, 
      email: user.email,
      resetLink 
    });
    
    await sendEmail({
      to: user.email,
      ...emailTemplates.passwordReset(user.name, resetLink),
    });
    
    logger.info('Password reset email sent successfully', { 
      userId: user.id, 
      email: user.email 
    });
  } catch (error: any) {
    logger.error('Failed to send password reset email', error);
    // Log more details in development
    logger.error('Email error details', {
      message: error.message,
      stack: error.stack,
      userId: user.id,
      email: user.email,
      resetLink,
    });
    // Re-throw error in development to see what's happening
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
    // Don't throw in production - user might still be able to reset via support
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw createError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
}

export async function sendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  if (user.emailVerified) {
    throw createError('Email already verified', 400, 'EMAIL_ALREADY_VERIFIED');
  }

  // Generate verification token — store hash, send plaintext to user
  const verificationToken = uuidv4();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = new Date();
  verificationExpires.setDate(verificationExpires.getDate() + 1); // 24 hours

  // Store token hash temporarily (we'll use passwordResetToken field for this)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: verificationTokenHash,
      passwordResetExpires: verificationExpires,
    },
  });

  // Send email
  const { sendEmail, emailTemplates } = await import('./emailService.js');
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
  
  try {
    await sendEmail({
      to: user.email,
      ...emailTemplates.emailVerification(user.name, verificationLink),
    });
  } catch (error) {
    logger.error('Failed to send verification email', error);
    throw createError('Failed to send verification email', 500, 'EMAIL_SEND_ERROR');
  }
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash, // Reusing this field for verification
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw createError('Invalid or expired verification token', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
}

// Export as service object
export const authService = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};

