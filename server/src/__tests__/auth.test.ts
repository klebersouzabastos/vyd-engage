import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authService } from '../services/authService.js';
import prisma from '../config/database.js';

describe('Auth Service', () => {
  let testTenantId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        slug: `test-company-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    // Cleanup
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } });
    }
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        companyName: 'Test Company',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      
      testUserId = result.user.id;
    });

    it('should throw error if email already exists', async () => {
      await authService.register({
        email: 'existing@example.com',
        password: 'password123',
        name: 'First User',
        companyName: 'First Company',
      });

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Second User',
          companyName: 'Second Company',
        })
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        name: 'Login User',
        companyName: 'Login Company',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.login({
        email: 'login@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('login@example.com');
    });

    it('should throw error with incorrect password', async () => {
      await expect(
        authService.login({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error with non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('password reset', () => {
    beforeEach(async () => {
      const result = await authService.register({
        email: 'reset@example.com',
        password: 'password123',
        name: 'Reset User',
        companyName: 'Reset Company',
      });
      testUserId = result.user.id;
    });

    it('should request password reset successfully', async () => {
      await expect(
        authService.requestPasswordReset('reset@example.com')
      ).resolves.not.toThrow();
    });

    it('should not reveal if email exists', async () => {
      // Should not throw even if email doesn't exist
      await expect(
        authService.requestPasswordReset('nonexistent@example.com')
      ).resolves.not.toThrow();
    });
  });
});

