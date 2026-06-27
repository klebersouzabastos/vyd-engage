import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authService } from '../services/authService.js';
import prisma from '../config/database.js';

describe('Auth Service', () => {
  let testTenantId: string;
  // Tests run against a persistent DB, so emails must be unique per run to avoid
  // USER_EXISTS collisions on re-runs. register() also creates its OWN tenant
  // (from companyName) — not testTenantId — so we track and clean those up too.
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];
  let seq = 0;
  const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${seq++}@example.com`;

  const trackRegister = async (args: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) => {
    const result = await authService.register(args);
    createdUserIds.push(result.user.id);
    if (result.user.tenantId) createdTenantIds.push(result.user.tenantId);
    return result;
  };

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        slug: `test-company-${Date.now()}-${seq++}`,
      },
    });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    // Clean up users first (cascades their refresh tokens), then the tenants each
    // registration created, then the bare tenant from beforeEach. Best-effort.
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
      createdUserIds.length = 0;
    }
    if (createdTenantIds.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } }).catch(() => {});
      createdTenantIds.length = 0;
    }
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
    }
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const email = uniqueEmail('test');
      const result = await trackRegister({
        email,
        password: 'password123',
        name: 'Test User',
        companyName: 'Test Company',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(email);
      expect(result.user.name).toBe('Test User');
    });

    it('should throw error if email already exists', async () => {
      const email = uniqueEmail('existing');
      await trackRegister({
        email,
        password: 'password123',
        name: 'First User',
        companyName: 'First Company',
      });

      await expect(
        authService.register({
          email,
          password: 'password123',
          name: 'Second User',
          companyName: 'Second Company',
        })
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    let loginEmail: string;

    beforeEach(async () => {
      loginEmail = uniqueEmail('login');
      await trackRegister({
        email: loginEmail,
        password: 'password123',
        name: 'Login User',
        companyName: 'Login Company',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.login({
        email: loginEmail,
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginEmail);
    });

    it('should throw error with incorrect password', async () => {
      await expect(
        authService.login({
          email: loginEmail,
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error with non-existent email', async () => {
      await expect(
        authService.login({
          email: uniqueEmail('nonexistent'),
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('password reset', () => {
    let resetEmail: string;

    beforeEach(async () => {
      resetEmail = uniqueEmail('reset');
      await trackRegister({
        email: resetEmail,
        password: 'password123',
        name: 'Reset User',
        companyName: 'Reset Company',
      });
    });

    it('should request password reset successfully', async () => {
      await expect(authService.requestPasswordReset(resetEmail)).resolves.not.toThrow();
    });

    it('should not reveal if email exists', async () => {
      // Should not throw even if email doesn't exist
      await expect(
        authService.requestPasswordReset(uniqueEmail('nonexistent'))
      ).resolves.not.toThrow();
    });
  });
});
