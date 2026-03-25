import { describe, expect, it } from 'vitest';
import { createQuery } from '../../../src/index.js';
import type {
  Query,
  TermQuery,
  MatchQuery,
  WildcardQuery,
  RangeQuery,
  ExistsQuery,
  MultiMatchQuery,
  BoolQuery,
  HighlightFieldOption,
  Highlight,
  OpenSearchQuery,
} from '../../../src/index.js';

interface Article {
  title: { exact: string };
  body: string;
  category: string;
  viewCount: number;
  isPublished: boolean;
  createdAt: Date;
}

describe('Query DSL type conformance', () => {
  describe('TermQuery', () => {
    it('builder output conforms to TermQuery structure', () => {
      const result = createQuery<Article>().term('category', 'tech').build();

      const termQuery = result.query!.term!;
      const field: Record<string, TermQuery> = termQuery;
      expect(field['category']).toEqual({ value: 'tech' });
      expect(field['category'].value).toBe('tech');
      expect(field['category'].boost).toBeUndefined();
    });

    it('term with boost conforms to TermQuery', () => {
      const result = createQuery<Article>().term('category', 'tech', 2.0).build();

      const field = result.query!.term!['category'];
      expect(field).toEqual({ value: 'tech', boost: 2.0 });
      expect(field.value).toBe('tech');
      expect(field.boost).toBe(2.0);
    });

    it('term supports string, number, boolean values', () => {
      const stringQuery = createQuery<Article>().term('category', 'tech').build();
      expect(stringQuery.query!.term!['category'].value).toBe('tech');

      const numberQuery = createQuery<Article>().term('viewCount', 100).build();
      expect(numberQuery.query!.term!['viewCount'].value).toBe(100);

      const booleanQuery = createQuery<Article>()
        .term('isPublished', true)
        .build();
      expect(booleanQuery.query!.term!['isPublished'].value).toBe(true);
    });
  });

  describe('MatchQuery', () => {
    it('builder output conforms to MatchQuery structure', () => {
      const result = createQuery<Article>().match('body', 'hello world').build();

      const matchQuery = result.query!.match!;
      const field: Record<string, MatchQuery> = matchQuery;
      expect(field['body']).toEqual({ query: 'hello world' });
      expect(field['body'].query).toBe('hello world');
      expect(field['body'].boost).toBeUndefined();
    });

    it('match with boost conforms to MatchQuery', () => {
      const result = createQuery<Article>()
        .match('body', 'hello world', 1.5)
        .build();

      const field = result.query!.match!['body'];
      expect(field).toEqual({ query: 'hello world', boost: 1.5 });
      expect(field.query).toBe('hello world');
      expect(field.boost).toBe(1.5);
    });
  });

  describe('WildcardQuery', () => {
    it('builder output conforms to WildcardQuery structure', () => {
      const result = createQuery<Article>()
        .wildcard('category', 'tech*')
        .build();

      const wildcardQuery = result.query!.wildcard!;
      const field: Record<string, WildcardQuery> = wildcardQuery;
      expect(field['category']).toEqual({ value: 'tech*' });
      expect(field['category'].value).toBe('tech*');
    });

    it('wildcard with boost conforms to WildcardQuery', () => {
      const result = createQuery<Article>()
        .wildcard('category', 'tech*', 0.5)
        .build();

      const field = result.query!.wildcard!['category'];
      expect(field).toEqual({ value: 'tech*', boost: 0.5 });
    });
  });

  describe('RangeQuery', () => {
    it('builder output conforms to RangeQuery with gte/lte', () => {
      const result = createQuery<Article>()
        .range('createdAt', { gte: '2025-01-01', lte: '2025-12-31' })
        .build();

      const rangeQuery = result.query!.range!;
      const field: Record<string, RangeQuery> = rangeQuery;
      expect(field['createdAt'].gte).toBe('2025-01-01');
      expect(field['createdAt'].lte).toBe('2025-12-31');
      expect(field['createdAt'].gt).toBeUndefined();
      expect(field['createdAt'].lt).toBeUndefined();
    });

    it('builder output conforms to RangeQuery with gt/lt', () => {
      const result = createQuery<Article>()
        .range('viewCount', { gt: 0, lt: 1000 })
        .build();

      const field = result.query!.range!['viewCount'];
      expect(field.gt).toBe(0);
      expect(field.lt).toBe(1000);
    });

    it('RangeQuery accepts boost', () => {
      const result = createQuery<Article>()
        .range('createdAt', { gte: '2025-01-01', boost: 2.0 })
        .build();

      const field = result.query!.range!['createdAt'];
      expect(field.gte).toBe('2025-01-01');
      expect(field.boost).toBe(2.0);
    });
  });

  describe('ExistsQuery', () => {
    it('builder output conforms to ExistsQuery structure', () => {
      const result = createQuery<Article>().exists('category').build();

      const existsQuery: ExistsQuery = result.query!.exists!;
      expect(existsQuery).toEqual({ field: 'category' });
      expect(existsQuery.field).toBe('category');
    });
  });

  describe('MultiMatchQuery', () => {
    it('builder output conforms to MultiMatchQuery structure', () => {
      const result = createQuery<Article>()
        .multiMatch('hello', [
          { field: 'title', boost: 2 },
          { field: 'body' },
        ])
        .build();

      const multiMatch: MultiMatchQuery = result.query!.multi_match!;
      expect(multiMatch.query).toBe('hello');
      expect(multiMatch.fields).toEqual(['title^2', 'body']);
      expect(multiMatch.type).toBe('best_fields');
    });

    it('multiMatch with explicit type conforms to MultiMatchQuery', () => {
      const result = createQuery<Article>()
        .multiMatch(
          'hello',
          [{ field: 'title' }, { field: 'body' }],
          'phrase',
        )
        .build();

      const multiMatch = result.query!.multi_match!;
      expect(multiMatch.type).toBe('phrase');
    });
  });

  describe('BoolQuery', () => {
    it('must clause conforms to BoolQuery structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.must((must) => {
            must.match('body', 'hello').term('category', 'tech');
          });
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.must).toHaveLength(2);
      expect(boolQuery.must![0].match).toBeDefined();
      expect(boolQuery.must![1].term).toBeDefined();
    });

    it('should clause conforms to BoolQuery structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.should((should) => {
            should.term('category', 'tech').term('category', 'science');
          });
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.should).toHaveLength(2);
    });

    it('filter clause conforms to BoolQuery structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.filter((filter) => {
            filter.term('isPublished', true);
          });
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.filter).toHaveLength(1);
      expect(boolQuery.filter![0].term!['isPublished'].value).toBe(true);
    });

    it('must_not clause conforms to BoolQuery structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.mustNot((mustNot) => {
            mustNot.term('category', 'spam');
          });
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.must_not).toHaveLength(1);
      expect(boolQuery.must_not![0].term!['category'].value).toBe('spam');
    });

    it('minimum_should_match conforms to BoolQuery', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool
            .should((should) => {
              should.term('category', 'tech').term('category', 'science');
            })
            .minimumShouldMatch(1);
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.minimum_should_match).toBe(1);
    });

    it('combined bool query conforms to BoolQuery structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool
            .must((must) => {
              must.match('body', 'hello');
            })
            .filter((filter) => {
              filter.term('isPublished', true).range('createdAt', { gte: '2025-01-01' });
            })
            .should((should) => {
              should.term('category', 'tech');
            })
            .mustNot((mustNot) => {
              mustNot.exists('category');
            });
        })
        .build();

      const boolQuery: BoolQuery = result.query!.bool!;
      expect(boolQuery.must).toHaveLength(1);
      expect(boolQuery.filter).toHaveLength(2);
      expect(boolQuery.should).toHaveLength(1);
      expect(boolQuery.must_not).toHaveLength(1);

      // Verify each clause has correct Query structure
      expect(boolQuery.must![0].match!['body'].query).toBe('hello');
      expect(boolQuery.filter![0].term!['isPublished'].value).toBe(true);
      expect(boolQuery.filter![1].range!['createdAt'].gte).toBe('2025-01-01');
      expect(boolQuery.should![0].term!['category'].value).toBe('tech');
      expect(boolQuery.must_not![0].exists!.field).toBe('category');
    });

    it('nested bool within collection conforms to Query structure', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.must((must) => {
            must.bool((innerBool) => {
              innerBool.should((should) => {
                should
                  .match('title.exact', 'hello')
                  .match('body', 'hello');
              });
            });
          });
        })
        .build();

      const outerBool: BoolQuery = result.query!.bool!;
      const innerQuery: Query = outerBool.must![0];
      const innerBool: BoolQuery = innerQuery.bool!;
      expect(innerBool.should).toHaveLength(2);
      expect(innerBool.should![0].match!['title.exact'].query).toBe('hello');
      expect(innerBool.should![1].match!['body'].query).toBe('hello');
    });
  });

  describe('Highlight', () => {
    it('builder output conforms to Highlight structure', () => {
      const result = createQuery<Article>()
        .highlight((h) => {
          h.tags(['<mark>'], ['</mark>']).field('title');
        })
        .build();

      const highlight: Highlight = result.highlight!;
      expect(highlight.pre_tags).toEqual(['<mark>']);
      expect(highlight.post_tags).toEqual(['</mark>']);
      expect(highlight.fields['title']).toBeDefined();
    });

    it('highlight field options conform to HighlightFieldOption', () => {
      const result = createQuery<Article>()
        .highlight((h) => {
          h.field('body', {
            fragmentSize: 150,
            numberOfFragments: 3,
            boundaryScanner: 'sentence',
            type: 'unified',
            noMatchSize: 100,
          });
        })
        .build();

      const fieldOption: HighlightFieldOption =
        result.highlight!.fields['body'];
      expect(fieldOption.fragment_size).toBe(150);
      expect(fieldOption.number_of_fragments).toBe(3);
      expect(fieldOption.boundary_scanner).toBe('sentence');
      expect(fieldOption.type).toBe('unified');
      expect(fieldOption.no_match_size).toBe(100);
    });

    it('highlight_query conforms to Query type', () => {
      const highlightQuery: Query = {
        match: { body: { query: 'hello' } },
      };

      const result = createQuery<Article>()
        .highlight((h) => {
          h.field('body').highlightQuery(highlightQuery);
        })
        .build();

      const highlight: Highlight = result.highlight!;
      expect(highlight.highlight_query).toBe(highlightQuery);
      expect(highlight.highlight_query!.match!['body'].query).toBe('hello');
    });
  });

  describe('OpenSearchQuery', () => {
    it('full query conforms to OpenSearchQuery structure', () => {
      const result: OpenSearchQuery = createQuery<Article>()
        .bool((bool) => {
          bool
            .must((must) => {
              must.match('body', 'hello');
            })
            .filter((filter) => {
              filter.term('category', 'tech');
            });
        })
        .sortBy('createdAt', 'desc')
        .size(20)
        .from(0)
        .source(['title', 'body', 'createdAt'])
        .highlight((h) => {
          h.tags(['<em>'], ['</em>']).field('body');
        })
        .build();

      expect(result.size).toBe(20);
      expect(result.from).toBe(0);
      expect(result.query).toBeDefined();
      expect(result.query!.bool).toBeDefined();
      expect(result.sort).toEqual([{ createdAt: { order: 'desc' } }]);
      expect(result._source).toEqual(['title', 'body', 'createdAt']);
      expect(result.highlight).toBeDefined();
      expect(result.highlight!.pre_tags).toEqual(['<em>']);
      expect(result.search_after).toBeUndefined();
    });

    it('search_after conforms to SearchAfter type', () => {
      const result = createQuery<Article>()
        .lastId([1.5, 'doc-123'])
        .build();

      expect(result.search_after).toEqual([1.5, 'doc-123']);
    });

    it('lastIdFromCursor parses cursor into SearchAfter', () => {
      const cursor = JSON.stringify([1.5, 'doc-123']);
      const result = createQuery<Article>()
        .lastIdFromCursor(cursor)
        .build();

      expect(result.search_after).toEqual([1.5, 'doc-123']);
    });
  });

  describe('Query type with collection builder queries', () => {
    it('each query in collection conforms to Query interface', () => {
      const result = createQuery<Article>()
        .bool((bool) => {
          bool.filter((filter) => {
            filter
              .term('category', 'tech')
              .match('body', 'hello')
              .wildcard('category', 'te*')
              .range('createdAt', { gte: '2025-01-01' })
              .exists('title')
              .multiMatch('world', [{ field: 'title' }, { field: 'body' }]);
          });
        })
        .build();

      const queries: Query[] = result.query!.bool!.filter!;
      expect(queries).toHaveLength(6);

      // Each element conforms to Query
      expect(queries[0].term!['category'].value).toBe('tech');
      expect(queries[1].match!['body'].query).toBe('hello');
      expect(queries[2].wildcard!['category'].value).toBe('te*');
      expect(queries[3].range!['createdAt'].gte).toBe('2025-01-01');
      expect(queries[4].exists!.field).toBe('title');
      expect(queries[5].multi_match!.query).toBe('world');
      expect(queries[5].multi_match!.fields).toEqual(['title', 'body']);
    });
  });

  describe('Query index signature allows custom query types', () => {
    it('accepts nested query via index signature', () => {
      const nestedQuery: Query = {
        nested: {
          path: 'comments',
          query: {
            match: { 'comments.text': { query: 'hello' } },
          },
        },
      };

      expect(nestedQuery.nested.path).toBe('comments');
      expect(nestedQuery.nested.query.match['comments.text'].query).toBe(
        'hello',
      );
    });

    it('accepts function_score query via index signature', () => {
      const functionScoreQuery: Query = {
        function_score: {
          query: { match_all: {} },
          functions: [
            { weight: 2, filter: { term: { category: { value: 'tech' } } } },
          ],
          score_mode: 'sum',
          boost_mode: 'multiply',
        },
      };

      expect(functionScoreQuery.function_score.score_mode).toBe('sum');
    });

    it('custom query can be passed to QueryCollectionBuilder.query()', () => {
      const customQuery: Query = {
        nested: {
          path: 'tags',
          query: { term: { 'tags.name': { value: 'typescript' } } },
        },
      };

      const result = createQuery<Article>()
        .bool((bool) => {
          bool.must((must) => {
            must.query(customQuery);
          });
        })
        .build();

      const queries = result.query!.bool!.must!;
      expect(queries).toHaveLength(1);
      expect(queries[0].nested.path).toBe('tags');
    });
  });
});
