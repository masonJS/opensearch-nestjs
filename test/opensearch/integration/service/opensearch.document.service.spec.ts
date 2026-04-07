import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import {
  createQuery,
  OpensearchModule,
  OpensearchDocumentService,
} from '../../../../src/index.js';
import {
  TestDoc,
  TEST_INDEX_NAME,
  TEST_INDEX_SETTINGS,
  createTestDoc,
} from '../test-index.js';
import { TestFixture } from '../test-fixture.js';

describe('OpensearchDocumentService', () => {
  let module: TestingModule;
  let client: Client;
  let documentService: OpensearchDocumentService;
  let fixture: TestFixture;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [OpensearchModule.forRoot({ node: 'http://localhost:9200' })],
    }).compile();
    client = module.get<Client>(Client);
    documentService = module.get<OpensearchDocumentService>(
      OpensearchDocumentService,
    );

    fixture = new TestFixture(client, TEST_INDEX_NAME);
    await fixture.createIndex(TEST_INDEX_SETTINGS);
  });

  beforeEach(async () => await fixture.clearDocuments());

  afterAll(async () => {
    await module.close();
  });

  describe('create()', () => {
    it('creates a document and makes it searchable', async () => {
      const doc = createTestDoc('title', 'body', 'TEST_A');
      await documentService.create(TEST_INDEX_NAME, doc);

      const result = await fixture.findQuery(
        createQuery<TestDoc>().match('title', 'title'),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.title).toBe('title');
      expect(result.hits[0].source.body).toBe('body');
      expect(result.hits[0].source.type).toBe('TEST_A');
    });
  });

  describe('update()', () => {
    it('updates an existing document', async () => {
      const created = await fixture.insertDocument(
        createTestDoc('original', 'body', 'TEST_A'),
      );

      await documentService.update<TestDoc>(TEST_INDEX_NAME, created.id, {
        title: 'updated',
      } as any);

      const result = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        created.id,
      );
      expect(result).not.toBeNull();
      expect(result!.title).toBe('updated');
      expect(result!.body).toBe('body');
    });

    it('throws for non-existing document', async () => {
      await expect(
        documentService.update(TEST_INDEX_NAME, 'non-existing-id', {
          title: 'updated',
        }),
      ).rejects.toThrow();
    });
  });

  describe('upsert()', () => {
    it('creates a new document when id does not exist', async () => {
      const newId = 'upsert-new-id';
      await documentService.upsert(TEST_INDEX_NAME, newId, {
        title: 'upserted',
        body: 'body',
        type: 'TEST_A',
      });

      const result = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        newId,
      );
      expect(result).not.toBeNull();
      expect(result!.title).toBe('upserted');
    });

    it('updates an existing document', async () => {
      const created = await fixture.insertDocument(
        createTestDoc('original', 'body', 'TEST_A'),
      );

      await documentService.upsert<TestDoc>(TEST_INDEX_NAME, created.id, {
        title: 'upserted-update',
      } as any);

      const result = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        created.id,
      );
      expect(result).not.toBeNull();
      expect(result!.title).toBe('upserted-update');
      expect(result!.body).toBe('body');
    });
  });

  describe('bulkUpdate()', () => {
    it('updates multiple documents', async () => {
      const docA = await fixture.insertDocument(
        createTestDoc('titleA', 'bodyA', 'TEST_A'),
      );
      const docB = await fixture.insertDocument(
        createTestDoc('titleB', 'bodyB', 'TEST_B'),
      );

      const result = await documentService.bulkUpdate<TestDoc>(
        TEST_INDEX_NAME,
        [
          { id: docA.id, doc: { title: 'updatedA' } as any },
          { id: docB.id, doc: { title: 'updatedB' } as any },
        ],
      );

      expect(result.errors).toBe(false);
      expect(result.items).toHaveLength(2);

      const updatedA = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        docA.id,
      );
      const updatedB = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        docB.id,
      );
      expect(updatedA!.title).toBe('updatedA');
      expect(updatedB!.title).toBe('updatedB');
    });

    it('returns empty result for empty array', async () => {
      const result = await documentService.bulkUpdate(TEST_INDEX_NAME, []);
      expect(result).toEqual({ errors: false, items: [] });
    });
  });

  describe('bulkUpsert()', () => {
    it('upserts multiple documents', async () => {
      const existing = await fixture.insertDocument(
        createTestDoc('original', 'body', 'TEST_A'),
      );

      const result = await documentService.bulkUpsert<TestDoc>(
        TEST_INDEX_NAME,
        [
          { id: existing.id, doc: { title: 'bulk-upserted' } as any },
          {
            id: 'new-bulk-upsert-id',
            doc: {
              title: 'new-doc',
              body: 'new-body',
              type: 'TEST_B',
            } as any,
          },
        ],
      );

      expect(result.errors).toBe(false);
      expect(result.items).toHaveLength(2);

      const updated = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        existing.id,
      );
      expect(updated!.title).toBe('bulk-upserted');
      expect(updated!.body).toBe('body');

      const created = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        'new-bulk-upsert-id',
      );
      expect(created).not.toBeNull();
      expect(created!.title).toBe('new-doc');
    });

    it('returns empty result for empty array', async () => {
      const result = await documentService.bulkUpsert(TEST_INDEX_NAME, []);
      expect(result).toEqual({ errors: false, items: [] });
    });
  });

  describe('getOne()', () => {
    it('retrieves a single document by ID', async () => {
      const doc = await fixture.insertDocument(
        createTestDoc('title', 'body', 'TEST_A'),
      );

      const result = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        doc.id,
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('title');
      expect(result!.body).toBe('body');
      expect(result!.type).toBe('TEST_A');
    });

    it('returns null for non-existing document', async () => {
      const result = await documentService.getOne<TestDoc>(
        TEST_INDEX_NAME,
        'non-existing-id',
      );
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('deletes a document', async () => {
      const doc = await fixture.insertDocument(
        createTestDoc('title', 'body', 'TEST_A'),
      );

      await documentService.delete(TEST_INDEX_NAME, doc.id);

      const result = await fixture.findQuery(createQuery<TestDoc>());
      expect(result.hits).toHaveLength(0);
    });

    it('does not throw for non-existing document', async () => {
      await expect(
        documentService.delete(TEST_INDEX_NAME, 'non-existing-id'),
      ).resolves.not.toThrow();
    });

    it('throws for non-existing index', async () => {
      await expect(
        documentService.delete('non-existing-index', 'some-id'),
      ).rejects.toThrow();
    });
  });

  describe('bulkCreate()', () => {
    it('creates multiple documents', async () => {
      const documents = [
        createTestDoc('title1', 'body1', 'TEST_A'),
        createTestDoc('title2', 'body2', 'TEST_B'),
        createTestDoc('title3', 'body3', 'TEST_A'),
      ];

      const result = await documentService.bulkCreate(
        TEST_INDEX_NAME,
        documents,
      );

      expect(result.errors).toBe(false);
      expect(result.items).toHaveLength(3);
      const all = await fixture.findQuery(createQuery<TestDoc>());
      expect(all.hits).toHaveLength(3);
    });

    it('returns empty result for empty array', async () => {
      const result = await documentService.bulkCreate(TEST_INDEX_NAME, []);
      expect(result).toEqual({ errors: false, items: [] });
    });
  });

  describe('bulkDelete()', () => {
    it('deletes multiple documents', async () => {
      const docA = await fixture.insertDocument(
        createTestDoc('title', 'body', 'TEST_A'),
      );
      const docB = await fixture.insertDocument(
        createTestDoc('title', 'body', 'TEST_B'),
      );
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));

      const result = await documentService.bulkDelete(TEST_INDEX_NAME, [
        docA.id,
        docB.id,
      ]);

      expect(result.errors).toBe(false);
      expect(result.items).toHaveLength(2);
      const remaining = await fixture.findQuery(createQuery<TestDoc>());
      expect(remaining.hits).toHaveLength(1);
    });

    it('returns empty result for empty array', async () => {
      const result = await documentService.bulkDelete(TEST_INDEX_NAME, []);
      expect(result).toEqual({ errors: false, items: [] });
    });
  });

  describe('deleteByQuery()', () => {
    it('deletes documents matching query', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const query = createQuery<TestDoc>().term('type', 'TEST_A').build();
      const deleted = await documentService.deleteByQuery(
        TEST_INDEX_NAME,
        query,
      );

      expect(deleted).toBe(2);
      const remaining = await fixture.findQuery(createQuery<TestDoc>());
      expect(remaining.hits).toHaveLength(1);
      expect(remaining.hits[0].source.type).toBe('TEST_B');
    });
  });
});
