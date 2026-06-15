import { describe, it, expect } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';
import { tagService } from '../../services/tagService.js';
import { tagFactory } from '../factories/index.js';

/**
 * Unit tests for tagService running against a mocked Prisma client (no DB).
 * Demonstrates the Story 1.3 testing infra: mockDeep + factories.
 */
describe('tagService (unit, mocked Prisma)', () => {
  const tenantId = 'tenant-1';

  describe('create', () => {
    it('creates a tag when the name is unique', async () => {
      const created = tagFactory.build({ tenantId, name: 'VIP', color: '#FF0000' });
      prismaMock.tag.findUnique.mockResolvedValue(null);
      prismaMock.tag.create.mockResolvedValue(created);

      const result = await tagService.create(tenantId, { name: 'VIP', color: '#FF0000' });

      expect(result).toEqual(created);
      expect(prismaMock.tag.create).toHaveBeenCalledWith({
        data: { tenantId, name: 'VIP', color: '#FF0000' },
      });
    });

    it('defaults the color when none is provided', async () => {
      prismaMock.tag.findUnique.mockResolvedValue(null);
      prismaMock.tag.create.mockResolvedValue(tagFactory.build());

      await tagService.create(tenantId, { name: 'Lead Quente' });

      expect(prismaMock.tag.create).toHaveBeenCalledWith({
        data: { tenantId, name: 'Lead Quente', color: '#2563EB' },
      });
    });

    it('rejects a duplicate tag name', async () => {
      prismaMock.tag.findUnique.mockResolvedValue(tagFactory.build({ tenantId, name: 'VIP' }));

      await expect(tagService.create(tenantId, { name: 'VIP' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'TAG_EXISTS',
      });
      expect(prismaMock.tag.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the tag when found', async () => {
      const tag = tagFactory.build({ id: 'tag-1', tenantId });
      prismaMock.tag.findFirst.mockResolvedValue(tag);

      await expect(tagService.findById(tenantId, 'tag-1')).resolves.toEqual(tag);
    });

    it('throws 404 when the tag is missing', async () => {
      prismaMock.tag.findFirst.mockResolvedValue(null);

      await expect(tagService.findById(tenantId, 'missing')).rejects.toMatchObject({
        statusCode: 404,
        code: 'TAG_NOT_FOUND',
      });
    });
  });

  describe('delete', () => {
    it('deletes after confirming the tag exists', async () => {
      const tag = tagFactory.build({ id: 'tag-1', tenantId });
      prismaMock.tag.findFirst.mockResolvedValue(tag);
      prismaMock.tag.delete.mockResolvedValue(tag);

      await tagService.delete(tenantId, 'tag-1');

      expect(prismaMock.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } });
    });
  });
});
