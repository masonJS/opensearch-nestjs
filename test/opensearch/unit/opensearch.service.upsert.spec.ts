import { describe, expect, it, vi } from 'vitest';
import { OpensearchDocumentService } from '../../../src/index.js';

describe('OpensearchDocumentService upsert utilities', () => {
  it('upsertDocument() calls update with doc_as_upsert', async () => {
    const update = vi.fn().mockResolvedValue({});
    const service = new OpensearchDocumentService({ update } as any);

    await service.upsert('test-index', 'doc-1', { title: 'hello' });

    expect(update).toHaveBeenCalledWith({
      index: 'test-index',
      id: 'doc-1',
      body: {
        doc: { title: 'hello' },
        doc_as_upsert: true,
      },
      refresh: true,
    });
  });

  it('bulkUpsert() returns empty result without calling client when input is empty', async () => {
    const bulk = vi.fn();
    const service = new OpensearchDocumentService({ bulk } as any);

    const result = await service.bulkUpsert('test-index', []);

    expect(result).toEqual({ errors: false, items: [] });
    expect(bulk).not.toHaveBeenCalled();
  });
});
