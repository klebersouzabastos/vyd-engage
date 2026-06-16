import prisma from '../config/database.js';
import { UserRole } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { hashToken } from '../utils/tokenHash.js';

export interface CreateInvitationData {
  email: string;
  role: UserRole;
}

export const invitationService = {
  async create(tenantId: string, invitedBy: string, data: CreateInvitationData) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw createError('User with this email already exists', 400, 'USER_EXISTS');
    }

    // Check if invitation already exists
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        tenantId,
        email: data.email,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw createError('Invitation already sent to this email', 400, 'INVITATION_EXISTS');
    }

    // Generate invitation token — store hash, send plaintext to user
    const token = uuidv4();
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        tenantId,
        email: data.email,
        role: data.role,
        token: tokenHash,
        invitedBy,
        expiresAt,
      },
    });

    // Send invitation email
    try {
      const { sendEmail, emailTemplates } = await import('./emailService.js');
      const inviter = await prisma.user.findUnique({
        where: { id: invitedBy },
        select: { name: true },
      });
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      
      const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;
      const roleLabel = data.role === 'ADMIN' ? 'Administrador' : data.role === 'USER' ? 'Usuário' : 'Visualizador';
      
      await sendEmail({
        to: invitation.email,
        ...(await emailTemplates.invitation(
          inviter?.name || 'Um administrador',
          tenant?.name || 'a empresa',
          invitationLink,
          roleLabel
        )),
      });
    } catch (error) {
      logger.error('Failed to send invitation email', error);
      // Don't throw - invitation is still created
    }

    return invitation;
  },

  async findAll(tenantId: string) {
    return prisma.invitation.findMany({
      where: {
        tenantId,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findByToken(token: string) {
    const tokenHash = hashToken(token);
    const invitation = await prisma.invitation.findFirst({
      where: { token: tokenHash },
      include: {
        tenant: true,
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.accepted) {
      throw createError('Invitation already accepted', 400, 'INVITATION_ACCEPTED');
    }

    if (invitation.expiresAt < new Date()) {
      throw createError('Invitation expired', 400, 'INVITATION_EXPIRED');
    }

    return invitation;
  },

  async accept(token: string, password: string, name: string) {
    const invitation = await this.findByToken(token);

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        name,
        tenantId: invitation.tenantId,
        role: invitation.role,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    });

    return user;
  },

  async cancel(tenantId: string, invitationId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId,
        accepted: false,
      },
    });

    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    });
  },
};


