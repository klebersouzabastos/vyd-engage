// SSO VYD ID — troca do vyd_token do portal id.vydhub.com pela sessão NATIVA
// do Engage. Montado em /auth/sso (fora do CSRF, como /auth/login — não há
// cookie de sessão ainda neste ponto).
//
// Política de provisionamento (decisão do dono do produto): SÓ QUEM JÁ EXISTE —
// casamos por e-mail (case-insensitive); se o usuário não existir no banco,
// respondemos 403 com mensagem clara. NUNCA criamos usuário nem tenant aqui.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { vydIdService } from '../services/vydIdService.js';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../utils/jwt.js';
import { setAuthCookies } from '../utils/cookies.js';
import { setCsrfCookie } from '../middleware/csrf.js';
import { createError } from '../middleware/errorHandler.js';
import { captureEvent } from '../utils/analytics.js';

const router = Router();

const exchangeSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

// POST /auth/sso/exchange — valida o vyd_token e, se o e-mail já tem conta,
// emite a sessão nativa reutilizando exatamente o padrão do /auth/login
// (generateAccessToken/generateRefreshToken + RefreshToken persistido +
// setAuthCookies + setCsrfCookie) e responde { user } na mesma forma.
// O 2FA local NÃO é exigido aqui: a autenticação forte é responsabilidade do
// IdP (portal VYD ID), que já validou o usuário antes de emitir o token.
router.post('/exchange', async (req, res, next) => {
  try {
    const { token } = exchangeSchema.parse(req.body);
    const identity = await vydIdService.verifyVydToken(token);

    // SÓ QUEM JÁ EXISTE: e-mails são armazenados normalizados (lowercase) e o
    // verifyVydToken já normaliza o e-mail do token — o findUnique casa direto.
    const user = await prisma.user.findUnique({
      where: { email: identity.email },
      include: { tenant: true },
    });

    if (!user) {
      return next(
        createError(
          'Seu e-mail ainda não tem conta no VYD Engage. Peça um convite ao gestor da sua equipe.',
          403,
          'SSO_USER_NOT_PROVISIONED'
        )
      );
    }

    if (user.status !== 'ACTIVE') {
      return next(createError('User account is not active', 403, 'USER_INACTIVE'));
    }

    // Update last login (mesmo padrão do authService.login)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    captureEvent({
      distinctId: user.id,
      event: 'user_logged_in',
      tenantId: user.tenantId,
      properties: { method: 'sso_vyd_id' },
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

    setAuthCookies(res, accessToken, refreshToken);
    setCsrfCookie(res);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              slug: user.tenant.slug,
              logo: user.tenant.logo,
            }
          : undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
