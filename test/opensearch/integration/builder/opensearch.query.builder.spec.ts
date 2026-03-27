import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@opensearch-project/opensearch';
import {
  createQuery,
  OpensearchModule,
  OpensearchDocumentService,
  OpensearchSearchService,
  OpensearchIndexService,
} from '../../../../src/index.js';
import {
  TestDoc,
  TEST_INDEX_NAME,
  TEST_INDEX_SETTINGS,
  createTestDoc,
} from '../test-index.js';
import { TestFixture } from '../test-fixture.js';

describe('OpensearchQueryBuilder', () => {
  let module: TestingModule;
  let client: Client;
  let documentService: OpensearchDocumentService;
  let searchService: OpensearchSearchService;
  let indexService: OpensearchIndexService;
  let fixture: TestFixture;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [OpensearchModule.forRoot({ node: 'http://localhost:9200' })],
    }).compile();
    client = module.get<Client>(Client);
    documentService = module.get<OpensearchDocumentService>(
      OpensearchDocumentService,
    );
    searchService = module.get<OpensearchSearchService>(
      OpensearchSearchService,
    );
    indexService = module.get<OpensearchIndexService>(OpensearchIndexService);

    fixture = new TestFixture(client, TEST_INDEX_NAME);
    await fixture.createIndex(TEST_INDEX_SETTINGS);
  });

  beforeEach(async () => await fixture.clearDocuments());

  afterAll(async () => {
    await module.close();
  });

  it('match query', async () => {
    const doc = createTestDoc('title', 'body', 'TEST_A');
    await fixture.insertDocument(doc);
    await fixture.insertDocument(doc);

    const result = await fixture.findQuery(
      createQuery<TestDoc>().match('title', 'title'),
    );

    expect(result.hits).toHaveLength(2);
    expect(result.hits[0].source.title).toBe(doc.title);
    expect(result.hits[0].source.body).toBe(doc.body);
  });

  it('term query', async () => {
    await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
    await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

    const result = await fixture.findQuery(
      createQuery<TestDoc>().term('type', 'TEST_A'),
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].source.type).toBe('TEST_A');
  });

  it('range Query gte & lte', async () => {
    await fixture.insertDocument(
      createTestDoc('title', 'body', 'TEST_A', new Date('2025-01-01')),
    );
    await fixture.insertDocument(
      createTestDoc('title', 'body', 'TEST_A', new Date('2025-01-10')),
    );

    const result = await fixture.findQuery(
      createQuery<TestDoc>().range('createdAt', {
        gte: '2025-01-05',
        lte: '2025-01-15',
      }),
    );

    expect(result.hits).toHaveLength(1);
  });

  it('range Query gte', async () => {
    await fixture.insertDocument(
      createTestDoc('title', 'body', 'TEST_A', new Date('2025-01-01')),
    );
    await fixture.insertDocument(
      createTestDoc('title', 'body', 'TEST_A', new Date('2025-01-10')),
    );

    const result = await fixture.findQuery(
      createQuery<TestDoc>().range('createdAt', { gte: '2025-01-05' }),
    );

    expect(result.hits).toHaveLength(1);
  });

  it('wildcard query', async () => {
    await fixture.insertDocument(createTestDoc('A title A ', 'body', 'TEST_A'));
    await fixture.insertDocument(createTestDoc('title B', 'body', 'TEST_B'));

    const result = await fixture.findQuery(
      createQuery<TestDoc>().wildcard('title', '*title*'),
    );

    expect(result.hits).toHaveLength(2);
  });

  it('should match query', async () => {
    const firstDoc = await fixture.insertDocument(
      createTestDoc('exact match title', 'body', 'TEST_A'),
    );
    const secondDoc = await fixture.insertDocument(
      createTestDoc('exactmatch title', 'body', 'TEST_A'),
    );

    const queryBuilder = createQuery<TestDoc>().bool((bool) => {
      bool.should((should) => {
        should
          .term('title.exact', 'exact match title', 3)
          .match('title', 'exact match title');
      });
    });

    const result = await fixture.findQuery(queryBuilder);

    expect(result.hits).toHaveLength(2);
    expect(result.hits[0].id).toBe(firstDoc.id);
    expect(result.hits[1].id).toBe(secondDoc.id);
  });

  it('filter query', async () => {
    await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
    await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

    const result = await fixture.findQuery(
      createQuery<TestDoc>().bool((bool) => {
        bool.filter((filter) => {
          filter.term('type', 'TEST_A');
        });
      }),
    );

    expect(result.hits).toHaveLength(1);
  });

  it('infinite scroll pagination', async () => {
    const firstDoc = await fixture.insertDocument(
      createTestDoc('a title', 'body', 'TEST_A'),
    );
    await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

    const searchRes = await fixture.findQuery(
      createQuery<TestDoc>()
        .bool((bool) => {
          bool.should((should) => {
            should.term('title.exact', 'title', 3).match('title', 'title', 2);
          });
        })
        .sort((sort) => {
          sort.field('_score', 'desc');
          sort.field('_id', 'desc');
        })
        .size(1),
    );

    const nextOffset = JSON.parse(searchRes.cursor!);

    const result = await fixture.findQuery(
      createQuery<TestDoc>()
        .bool((bool) => {
          bool.should((should) => {
            should.term('title.exact', 'title', 3).match('title', 'title', 2);
          });
        })
        .sort((sort) => {
          sort.field('_score', 'desc');
          sort.field('_id', 'desc');
        })
        .lastId(nextOffset)
        .size(1),
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].id).toBe(firstDoc.id);
  });

  it('highlight query', async () => {
    await fixture.insertDocument(
      createTestDoc('titleA', 'bodyA.\n bodyB', 'TEST_A'),
    );

    const result = await fixture.findQuery(
      createQuery<TestDoc>()
        .bool((bool) => {
          bool.should((should) => {
            should.match('title', 'titleA');
          });
        })
        .highlight((highlight) => {
          highlight.tags(['<mark>'], ['</mark>']).field('title');
        }),
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].getHighlightSentence('title')).toMatchInlineSnapshot(
      `"<mark>titleA</mark>"`,
    );
  });

  it('highlight query with camelCase options', async () => {
    await fixture.insertDocument(
      createTestDoc('titleA', 'bodyA.\n bodyB', 'TEST_A'),
    );

    const result = await fixture.findQuery(
      createQuery<TestDoc>()
        .bool((bool) => {
          bool.should((should) => {
            should.match('title', 'titleA');
          });
        })
        .highlight((highlight) => {
          highlight.tags(['<mark>'], ['</mark>']).field('title', {
            fragmentSize: 150,
            numberOfFragments: 3,
          });
        }),
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].getHighlightSentence('title')).toMatchInlineSnapshot(
      `"<mark>titleA</mark>"`,
    );
  });

  describe('when()', () => {
    it('applies query when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().when(true, (q) => {
          q.term('type', 'TEST_A');
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('skips query when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().when(false, (q) => {
          q.term('type', 'TEST_A');
        }),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('BoolQueryBuilder.when() applies bool clause when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.when(true, (b) => {
            b.filter((filter) => {
              filter.term('type', 'TEST_A');
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('BoolQueryBuilder.when() skips bool clause when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.when(false, (b) => {
            b.filter((filter) => {
              filter.term('type', 'TEST_A');
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('QueryCollectionBuilder.when() applies collection query when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.when(true, (f) => {
              f.term('type', 'TEST_A');
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('QueryCollectionBuilder.when() skips collection query when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.when(false, (f) => {
              f.term('type', 'TEST_A');
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });
  });

  describe('whenElse()', () => {
    it('applies trueBuilder when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().whenElse(
          true,
          (q) => q.term('type', 'TEST_A'),
          (q) => q.term('type', 'TEST_B'),
        ),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('applies falseBuilder when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().whenElse(
          false,
          (q) => q.term('type', 'TEST_A'),
          (q) => q.term('type', 'TEST_B'),
        ),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_B');
    });

    it('BoolQueryBuilder.whenElse() applies trueBuilder when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.whenElse(
            true,
            (b) => b.filter((f) => f.term('type', 'TEST_A')),
            (b) => b.filter((f) => f.term('type', 'TEST_B')),
          );
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('BoolQueryBuilder.whenElse() applies falseBuilder when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.whenElse(
            false,
            (b) => b.filter((f) => f.term('type', 'TEST_A')),
            (b) => b.filter((f) => f.term('type', 'TEST_B')),
          );
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_B');
    });

    it('QueryCollectionBuilder.whenElse() applies trueBuilder when condition is true', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.whenElse(
              true,
              (f) => f.term('type', 'TEST_A'),
              (f) => f.term('type', 'TEST_B'),
            );
          });
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('QueryCollectionBuilder.whenElse() applies falseBuilder when condition is false', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.whenElse(
              false,
              (f) => f.term('type', 'TEST_A'),
              (f) => f.term('type', 'TEST_B'),
            );
          });
        }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_B');
    });
  });

  describe('each()', () => {
    it('applies query for each array item', async () => {
      await fixture.insertDocument(
        createTestDoc('keyword1 title', 'body', 'TEST_A'),
      );
      await fixture.insertDocument(
        createTestDoc('keyword2 title', 'body', 'TEST_B'),
      );
      await fixture.insertDocument(createTestDoc('other', 'body', 'TEST_A'));

      const keywords = ['keyword1', 'keyword2'];
      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.should((should) => {
            should.each(keywords, (s, keyword) => {
              s.match('title', keyword);
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('no-op for empty array', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.each([], (f, keyword: string) => {
              f.term('type', keyword);
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('no-op for null', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.filter((filter) => {
            filter.each(null, (f, keyword: string) => {
              f.term('type', keyword);
            });
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });
  });

  describe('lastIdFromCursor()', () => {
    it('sets search_after from valid cursor', async () => {
      const firstDoc = await fixture.insertDocument(
        createTestDoc('a title', 'body', 'TEST_A'),
      );
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const searchRes = await fixture.findQuery(
        createQuery<TestDoc>()
          .sort((sort) => {
            sort.field('_id', 'desc');
          })
          .size(1),
      );

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .sort((sort) => {
            sort.field('_id', 'desc');
          })
          .lastIdFromCursor(searchRes.cursor)
          .size(1),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe(firstDoc.id);
    });

    it('no-op for null cursor', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().lastIdFromCursor(null),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('no-op for undefined cursor', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().lastIdFromCursor(undefined),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('throws Error for invalid JSON cursor', () => {
      expect(() => {
        createQuery<TestDoc>().lastIdFromCursor('invalid-json').build();
      }).toThrow('Invalid cursor format: invalid-json');
    });
  });

  describe('multiMatch()', () => {
    it('searches across multiple fields', async () => {
      await fixture.insertDocument(
        createTestDoc('hello world', 'plain body', 'TEST_A'),
      );
      await fixture.insertDocument(
        createTestDoc('other title', 'hello world body', 'TEST_B'),
      );
      await fixture.insertDocument(createTestDoc('zzz', 'zzz body', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().bool((bool) => {
          bool.should((should) => {
            should.multiMatch('hello', [
              { field: 'title', boost: 2 },
              { field: 'body', boost: 1 },
            ]);
          });
        }),
      );

      expect(result.hits).toHaveLength(2);
    });

    it('preserves bool query when combined with multiMatch', async () => {
      await fixture.insertDocument(
        createTestDoc('hello world', 'plain body', 'TEST_A'),
      );
      await fixture.insertDocument(
        createTestDoc('hello world', 'plain body', 'TEST_B'),
      );
      await fixture.insertDocument(createTestDoc('zzz', 'zzz body', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.filter((f) => f.term('type', 'TEST_A'));
          })
          .multiMatch('hello', [{ field: 'title' }, { field: 'body' }]),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.type).toBe('TEST_A');
    });

    it('uses multiMatch as standalone query', async () => {
      await fixture.insertDocument(
        createTestDoc('hello world', 'plain body', 'TEST_A'),
      );
      await fixture.insertDocument(createTestDoc('zzz', 'zzz body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().multiMatch('hello', [{ field: 'title' }]),
      );

      expect(result.hits).toHaveLength(1);
    });
  });

  describe('HighlightBuilder.fields()', () => {
    it('sets multiple highlight fields in batch', async () => {
      await fixture.insertDocument(createTestDoc('titleA', 'bodyA', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should.match('title', 'titleA');
            });
          })
          .highlight((highlight) => {
            highlight
              .tags(['<mark>'], ['</mark>'])
              .fields([
                { name: 'title' },
                { name: 'body', fragmentSize: 150, numberOfFragments: 3 },
              ]);
          }),
      );

      expect(result.hits).toHaveLength(1);
      expect(
        result.hits[0].getHighlightSentence('title'),
      ).toMatchInlineSnapshot(`"<mark>titleA</mark>"`);
    });

    it('no-op for empty array', async () => {
      await fixture.insertDocument(createTestDoc('titleA', 'bodyA', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should.match('title', 'titleA');
            });
          })
          .highlight((highlight) => {
            highlight.tags(['<mark>'], ['</mark>']).field('title').fields([]);
          }),
      );

      expect(result.hits).toHaveLength(1);
      expect(
        result.hits[0].getHighlightSentence('title'),
      ).toMatchInlineSnapshot(`"<mark>titleA</mark>"`);
    });
  });

  describe('OpensearchDocumentService delete', () => {
    it('deleteDocument() deletes a document', async () => {
      const doc = await fixture.insertDocument(
        createTestDoc('title', 'body', 'TEST_A'),
      );

      await documentService.delete(TEST_INDEX_NAME, doc.id);

      const result = await fixture.findQuery(createQuery<TestDoc>());
      expect(result.hits).toHaveLength(0);
    });

    it('deleteDocument() does not throw for non-existing document', async () => {
      await expect(
        documentService.delete(TEST_INDEX_NAME, 'non-existing-id'),
      ).resolves.not.toThrow();
    });

    it('deleteDocument() throws for non-existing index', async () => {
      await expect(
        documentService.delete('non-existing-index', 'some-id'),
      ).rejects.toThrow();
    });

    it('bulkDelete() deletes multiple documents', async () => {
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

    it('bulkDelete() returns empty result for empty array', async () => {
      const result = await documentService.bulkDelete(TEST_INDEX_NAME, []);
      expect(result).toEqual({ errors: false, items: [] });
    });
  });

  describe('SortBuilder.score()', () => {
    it('sorts by _score', async () => {
      const firstDoc = await fixture.insertDocument(
        createTestDoc('exact match title', 'body', 'TEST_A'),
      );
      const secondDoc = await fixture.insertDocument(
        createTestDoc('exactmatch title', 'body', 'TEST_A'),
      );

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should
                .term('title.exact', 'exact match title', 3)
                .match('title', 'exact match title');
            });
          })
          .sort((sort) => {
            sort.score('desc').field('_id', 'desc');
          }),
      );

      expect(result.hits).toHaveLength(2);
      expect(result.hits[0].id).toBe(firstDoc.id);
      expect(result.hits[1].id).toBe(secondDoc.id);
    });
  });

  describe('OpensearchDocumentService.getDocument()', () => {
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

  describe('OpensearchSearchService.count()', () => {
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

  describe('OpensearchDocumentService.deleteByQuery()', () => {
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

  describe('OpensearchDocumentService.bulkCreate()', () => {
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

  describe('OpensearchIndexService.deleteIndex()', () => {
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

  describe('SearchResponse.total', () => {
    it('returns total hit count', async () => {
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_A'));
      await fixture.insertDocument(createTestDoc('title', 'body', 'TEST_B'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>().match('title', 'title'),
      );

      expect(result.total).toBe(2);
      expect(result.hits).toHaveLength(2);
    });

    it('returns 0 when no results', async () => {
      const result = await fixture.findQuery(
        createQuery<TestDoc>().match('title', 'nonexistent-keyword'),
      );

      expect(result.total).toBe(0);
      expect(result.isEmpty).toBe(true);
    });
  });

  describe('SearchHitResponse highlight methods', () => {
    it('getHighlight(field) returns highlight array', async () => {
      await fixture.insertDocument(createTestDoc('titleA', 'bodyA', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should.match('title', 'titleA');
            });
          })
          .highlight((highlight) => {
            highlight.tags(['<mark>'], ['</mark>']).field('title');
          }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].getHighlight('title')).toEqual([
        '<mark>titleA</mark>',
      ]);
      expect(result.hits[0].getHighlight('nonexistent')).toBeUndefined();
    });

    it('getHighlightFirst(field) returns first highlight', async () => {
      await fixture.insertDocument(createTestDoc('titleA', 'bodyA', 'TEST_A'));

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should.match('title', 'titleA');
            });
          })
          .highlight((highlight) => {
            highlight.tags(['<mark>'], ['</mark>']).field('title');
          }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].getHighlightFirst('title')).toBe(
        '<mark>titleA</mark>',
      );
      expect(result.hits[0].getHighlightFirst('nonexistent')).toBeUndefined();
    });

    it('getHighlightSentence(field) extracts highlighted sentence', async () => {
      await fixture.insertDocument(
        createTestDoc('titleA', 'bodyA.\n bodyB', 'TEST_A'),
      );

      const result = await fixture.findQuery(
        createQuery<TestDoc>()
          .bool((bool) => {
            bool.should((should) => {
              should.match('title', 'titleA');
            });
          })
          .highlight((highlight) => {
            highlight.tags(['<mark>'], ['</mark>']).field('title');
          }),
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].getHighlightSentence('title')).toBe(
        '<mark>titleA</mark>',
      );
      expect(
        result.hits[0].getHighlightSentence('nonexistent'),
      ).toBeUndefined();
    });
  });
});
