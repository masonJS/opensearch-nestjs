import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import {
  createQuery,
  OpensearchModule,
  OpensearchSearchService,
} from '../../../../src/index.js';
import {
  TestDoc,
  TEST_INDEX_NAME,
  TEST_INDEX_SETTINGS,
  createTestDoc,
} from '../test-index.js';
import { TestFixture } from '../test-fixture.js';

describe('OpensearchSearchService', () => {
  let module: TestingModule;
  let client: Client;
  let searchService: OpensearchSearchService;
  let fixture: TestFixture;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [OpensearchModule.forRoot({ node: 'http://localhost:9200' })],
    }).compile();
    client = module.get<Client>(Client);
    searchService =
      module.get<OpensearchSearchService>(OpensearchSearchService);

    fixture = new TestFixture(client, TEST_INDEX_NAME);
    await fixture.createIndex(TEST_INDEX_SETTINGS);
  });

  beforeEach(async () => await fixture.clearDocuments());

  afterAll(async () => {
    await module.close();
  });

  describe('search()', () => {
    it('returns SearchResponse with hits', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const query = createQuery<TestDoc>().match('title', 'title').build();
      const result = await searchService.search<TestDoc>(
        TEST_INDEX_NAME,
        query,
      );

      expect(result.total).toBe(2);
      expect(result.hits).toHaveLength(2);
      expect(result.isEmpty).toBe(false);
    });

    it('returns empty SearchResponse when no matches', async () => {
      const query = createQuery<TestDoc>()
        .match('title', 'nonexistent')
        .build();
      const result = await searchService.search<TestDoc>(
        TEST_INDEX_NAME,
        query,
      );

      expect(result.total).toBe(0);
      expect(result.hits).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
    });

    it('supports multi-index search', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));

      const query = createQuery<TestDoc>().match('title', 'title').build();
      const result = await searchService.search<TestDoc>(
        [TEST_INDEX_NAME],
        query,
      );

      expect(result.total).toBe(1);
    });
  });

  describe('count()', () => {
    it('returns total document count', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await searchService.count(TEST_INDEX_NAME);
      expect(result).toBe(2);
    });

    it('returns count matching query', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));

      const query = createQuery<TestDoc>().term('type', 'TEST_A').build();
      const result = await searchService.count(TEST_INDEX_NAME, query);
      expect(result).toBe(2);
    });

    it('returns 0 when no documents exist', async () => {
      const result = await searchService.count(TEST_INDEX_NAME);
      expect(result).toBe(0);
    });
  });
});
