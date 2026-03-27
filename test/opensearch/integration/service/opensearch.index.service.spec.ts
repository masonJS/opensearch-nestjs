import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import {
  OpensearchModule,
  OpensearchIndexService,
} from '../../../../src/index.js';

describe('OpensearchIndexService', () => {
  let module: TestingModule;
  let client: Client;
  let indexService: OpensearchIndexService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [OpensearchModule.forRoot({ node: 'http://localhost:9200' })],
    }).compile();
    client = module.get<Client>(Client);
    indexService = module.get<OpensearchIndexService>(OpensearchIndexService);
  });

  afterAll(async () => {
    await module.close();
  });

  async function deleteIndexIfExists(index: string) {
    const exists = await client.indices.exists({ index });
    if (exists.body) {
      await client.indices.delete({ index });
    }
  }

  describe('create()', () => {
    const tempIndex = 'test-create-index';

    afterEach(async () => await deleteIndexIfExists(tempIndex));

    it('creates a new index', async () => {
      await indexService.create(tempIndex, {
        mappings: { properties: { title: { type: 'text' } } },
      });

      const exists = await client.indices.exists({ index: tempIndex });
      expect(exists.body).toBe(true);
    });

    it('does not throw when index already exists', async () => {
      await indexService.create(tempIndex, {
        mappings: { properties: { title: { type: 'text' } } },
      });

      await expect(
        indexService.create(tempIndex, {
          mappings: { properties: { title: { type: 'text' } } },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('putMapping()', () => {
    const tempIndex = 'test-putmapping-index';

    beforeEach(async () => {
      await deleteIndexIfExists(tempIndex);
      await indexService.create(tempIndex, {
        mappings: { properties: { title: { type: 'text' } } },
      });
    });

    afterEach(async () => await deleteIndexIfExists(tempIndex));

    it('adds new field mappings to existing index', async () => {
      await indexService.putMapping(tempIndex, {
        description: { type: 'text' },
      });

      const mapping = await client.indices.getMapping({ index: tempIndex });
      const properties = mapping.body[tempIndex].mappings.properties;
      expect(properties.description).toEqual({ type: 'text' });
      expect(properties.title).toEqual({ type: 'text' });
    });
  });

  describe('delete()', () => {
    it('deletes an index', async () => {
      const tempIndex = 'test-delete-index';
      await indexService.create(tempIndex, {
        mappings: { properties: { title: { type: 'text' } } },
      });

      await indexService.delete(tempIndex);

      const exists = await client.indices.exists({ index: tempIndex });
      expect(exists.body).toBe(false);
    });

    it('does not throw for non-existing index', async () => {
      await expect(
        indexService.delete('non-existing-index'),
      ).resolves.not.toThrow();
    });
  });
});
