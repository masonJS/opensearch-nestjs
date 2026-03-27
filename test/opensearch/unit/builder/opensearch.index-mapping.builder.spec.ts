import { describe, expect, it } from 'vitest';
import { createIndexMapping } from '../../../../src/index.js';

describe('IndexMappingBuilder', () => {
  it('builds a basic mapping with text and keyword fields', () => {
    const mapping = createIndexMapping()
      .text('title', { keyword: true })
      .keyword('status')
      .date('createdAt')
      .build();

    expect(mapping).toEqual({
      mappings: {
        properties: {
          title: {
            type: 'text',
            fields: { exact: { type: 'keyword' } },
          },
          status: { type: 'keyword' },
          createdAt: { type: 'date' },
        },
      },
    });
  });

  it('builds settings with shards and replicas', () => {
    const mapping = createIndexMapping()
      .settings({ numberOfShards: 3, numberOfReplicas: 1 })
      .keyword('id')
      .build();

    expect(mapping.settings).toEqual({
      index: {
        number_of_shards: 3,
        number_of_replicas: 1,
      },
    });
  });

  it('builds text field with keyword subfield options', () => {
    const mapping = createIndexMapping()
      .text('body', { keyword: true, index: false, ignoreAbove: 10000 })
      .build();

    expect(mapping.mappings.properties.body).toEqual({
      type: 'text',
      fields: {
        exact: { type: 'keyword', index: false, ignore_above: 10000 },
      },
    });
  });

  it('builds text field with analyzer', () => {
    const mapping = createIndexMapping()
      .text('title', {
        analyzer: 'custom_analyzer',
        searchAnalyzer: 'standard',
      })
      .build();

    expect(mapping.mappings.properties.title).toEqual({
      type: 'text',
      analyzer: 'custom_analyzer',
      search_analyzer: 'standard',
    });
  });

  it('builds plain text field without options', () => {
    const mapping = createIndexMapping().text('description').build();

    expect(mapping.mappings.properties.description).toEqual({ type: 'text' });
  });

  it('builds numeric fields', () => {
    const mapping = createIndexMapping()
      .integer('viewCount')
      .long('totalBytes')
      .float('rating')
      .double('price')
      .build();

    expect(mapping.mappings.properties).toEqual({
      viewCount: { type: 'integer' },
      totalBytes: { type: 'long' },
      rating: { type: 'float' },
      price: { type: 'double' },
    });
  });

  it('builds boolean field', () => {
    const mapping = createIndexMapping().boolean('isPublished').build();

    expect(mapping.mappings.properties.isPublished).toEqual({
      type: 'boolean',
    });
  });

  it('builds nested field', () => {
    const mapping = createIndexMapping()
      .nested('comments', (b) => {
        b.text('content').keyword('author').date('createdAt');
      })
      .build();

    expect(mapping.mappings.properties.comments).toEqual({
      type: 'nested',
      properties: {
        content: { type: 'text' },
        author: { type: 'keyword' },
        createdAt: { type: 'date' },
      },
    });
  });

  it('builds object field', () => {
    const mapping = createIndexMapping()
      .object('metadata', (b) => {
        b.keyword('source').integer('version');
      })
      .build();

    expect(mapping.mappings.properties.metadata).toEqual({
      type: 'object',
      properties: {
        source: { type: 'keyword' },
        version: { type: 'integer' },
      },
    });
  });

  it('builds custom field mapping', () => {
    const mapping = createIndexMapping()
      .custom('location', {
        type: 'geo_point',
      })
      .build();

    expect(mapping.mappings.properties.location).toEqual({
      type: 'geo_point',
    });
  });

  it('builds settings with analysis configuration', () => {
    const mapping = createIndexMapping()
      .settings({
        numberOfShards: 1,
        numberOfReplicas: 0,
        maxNgramDiff: 3,
        analysis: {
          tokenizer: {
            bigram: {
              type: 'ngram',
              min_gram: 2,
              max_gram: 5,
            },
          },
          analyzer: {
            bigram_analyzer: {
              type: 'custom',
              tokenizer: 'bigram',
            },
          },
        },
      })
      .text('title', { analyzer: 'bigram_analyzer' })
      .build();

    expect(mapping.settings.index.max_ngram_diff).toBe(3);
    expect(mapping.settings.analysis.tokenizer.bigram.type).toBe('ngram');
    expect(mapping.mappings.properties.title.analyzer).toBe('bigram_analyzer');
  });

  it('omits settings when not configured', () => {
    const mapping = createIndexMapping().keyword('id').build();

    expect(mapping.settings).toBeUndefined();
  });

  it('builds a complete article index mapping', () => {
    const mapping = createIndexMapping()
      .settings({ numberOfShards: 3, numberOfReplicas: 1 })
      .text('title', { keyword: true })
      .text('body', { keyword: true, index: false, ignoreAbove: 10000 })
      .keyword('category')
      .keyword('status')
      .boolean('isPublished')
      .integer('viewCount')
      .date('createdAt')
      .date('updatedAt')
      .build();

    expect(Object.keys(mapping.mappings.properties)).toHaveLength(8);
    expect(mapping.settings.index.number_of_shards).toBe(3);
  });

  // ── 1. Common field options ─────────────────

  describe('common field options', () => {
    it('applies docValues, store, nullValue, copyTo to keyword field', () => {
      const mapping = createIndexMapping()
        .keyword('status', {
          docValues: false,
          store: true,
          nullValue: 'unknown',
          copyTo: 'all_fields',
        })
        .build();

      expect(mapping.mappings.properties.status).toEqual({
        type: 'keyword',
        doc_values: false,
        store: true,
        null_value: 'unknown',
        copy_to: 'all_fields',
      });
    });

    it('applies common options to date field with format', () => {
      const mapping = createIndexMapping()
        .date('createdAt', {
          format: 'yyyy-MM-dd',
          index: false,
          nullValue: '1970-01-01',
        })
        .build();

      expect(mapping.mappings.properties.createdAt).toEqual({
        type: 'date',
        format: 'yyyy-MM-dd',
        index: false,
        null_value: '1970-01-01',
      });
    });

    it('applies common options to boolean field', () => {
      const mapping = createIndexMapping()
        .boolean('isActive', { nullValue: false, docValues: false })
        .build();

      expect(mapping.mappings.properties.isActive).toEqual({
        type: 'boolean',
        null_value: false,
        doc_values: false,
      });
    });

    it('applies common options to numeric fields', () => {
      const mapping = createIndexMapping()
        .integer('count', { coerce: false, nullValue: 0 })
        .float('score', { store: true })
        .build();

      expect(mapping.mappings.properties.count).toEqual({
        type: 'integer',
        coerce: false,
        null_value: 0,
      });
      expect(mapping.mappings.properties.score).toEqual({
        type: 'float',
        store: true,
      });
    });

    it('applies copyTo as an array', () => {
      const mapping = createIndexMapping()
        .text('firstName', { copyTo: ['fullName', 'searchField'] })
        .build();

      expect(mapping.mappings.properties.firstName).toEqual({
        type: 'text',
        copy_to: ['fullName', 'searchField'],
      });
    });

    it('applies keyword-specific options: ignoreAbove and normalizer', () => {
      const mapping = createIndexMapping()
        .keyword('email', { ignoreAbove: 256, normalizer: 'lowercase' })
        .build();

      expect(mapping.mappings.properties.email).toEqual({
        type: 'keyword',
        ignore_above: 256,
        normalizer: 'lowercase',
      });
    });
  });

  // ── 3. Dynamic mapping ──────────────────────

  describe('dynamic mapping', () => {
    it('sets dynamic to strict at index level', () => {
      const mapping = createIndexMapping()
        .dynamic('strict')
        .keyword('id')
        .build();

      expect(mapping.mappings.dynamic).toBe('strict');
    });

    it('sets dynamic to false at index level', () => {
      const mapping = createIndexMapping().dynamic(false).keyword('id').build();

      expect(mapping.mappings.dynamic).toBe(false);
    });

    it('sets dynamic on nested field', () => {
      const mapping = createIndexMapping()
        .nested('tags', { dynamic: 'strict' }, (b) => {
          b.keyword('name');
        })
        .build();

      expect(mapping.mappings.properties.tags).toEqual({
        type: 'nested',
        dynamic: 'strict',
        properties: {
          name: { type: 'keyword' },
        },
      });
    });

    it('sets dynamic on object field', () => {
      const mapping = createIndexMapping()
        .object('metadata', { dynamic: false }, (b) => {
          b.keyword('source');
        })
        .build();

      expect(mapping.mappings.properties.metadata).toEqual({
        type: 'object',
        dynamic: false,
        properties: {
          source: { type: 'keyword' },
        },
      });
    });

    it('omits dynamic when not configured', () => {
      const mapping = createIndexMapping().keyword('id').build();

      expect(mapping.mappings.dynamic).toBeUndefined();
    });
  });

  // ── 4. _source configuration ────────────────

  describe('_source configuration', () => {
    it('disables _source', () => {
      const mapping = createIndexMapping()
        .source({ enabled: false })
        .keyword('id')
        .build();

      expect(mapping.mappings._source).toEqual({ enabled: false });
    });

    it('sets _source includes and excludes', () => {
      const mapping = createIndexMapping()
        .source({
          includes: ['title', 'body'],
          excludes: ['internal_*'],
        })
        .keyword('id')
        .build();

      expect(mapping.mappings._source).toEqual({
        includes: ['title', 'body'],
        excludes: ['internal_*'],
      });
    });

    it('omits _source when not configured', () => {
      const mapping = createIndexMapping().keyword('id').build();

      expect(mapping.mappings._source).toBeUndefined();
    });
  });

  // ── 5. Multi-field support ──────────────────

  describe('multi-field support', () => {
    it('adds custom multi-fields to text field', () => {
      const mapping = createIndexMapping()
        .text('title', {
          fields: {
            raw: { type: 'keyword' },
            english: { type: 'text', analyzer: 'english' },
          },
        })
        .build();

      expect(mapping.mappings.properties.title).toEqual({
        type: 'text',
        fields: {
          raw: { type: 'keyword' },
          english: { type: 'text', analyzer: 'english' },
        },
      });
    });

    it('merges keyword shortcut with custom multi-fields', () => {
      const mapping = createIndexMapping()
        .text('title', {
          keyword: true,
          fields: {
            ngram: { type: 'text', analyzer: 'ngram_analyzer' },
          },
        })
        .build();

      expect(mapping.mappings.properties.title.fields).toEqual({
        exact: { type: 'keyword' },
        ngram: { type: 'text', analyzer: 'ngram_analyzer' },
      });
    });

    it('adds multi-fields to keyword field', () => {
      const mapping = createIndexMapping()
        .keyword('tag', {
          fields: {
            text: { type: 'text', analyzer: 'standard' },
          },
        })
        .build();

      expect(mapping.mappings.properties.tag).toEqual({
        type: 'keyword',
        fields: {
          text: { type: 'text', analyzer: 'standard' },
        },
      });
    });

    it('adds multi-fields to date field', () => {
      const mapping = createIndexMapping()
        .date('timestamp', {
          fields: {
            keyword: { type: 'keyword' },
          },
        })
        .build();

      expect(mapping.mappings.properties.timestamp).toEqual({
        type: 'date',
        fields: {
          keyword: { type: 'keyword' },
        },
      });
    });
  });

  // ── 7. enabled: false ───────────────────────

  describe('enabled: false', () => {
    it('creates a disabled object field via disabled() method', () => {
      const mapping = createIndexMapping().disabled('rawData').build();

      expect(mapping.mappings.properties.rawData).toEqual({
        type: 'object',
        enabled: false,
      });
    });

    it('creates a disabled object field via object() options', () => {
      const mapping = createIndexMapping()
        .object('metadata', { enabled: false }, (b) => {
          b.keyword('source');
        })
        .build();

      expect(mapping.mappings.properties.metadata).toEqual({
        type: 'object',
        enabled: false,
        properties: {
          source: { type: 'keyword' },
        },
      });
    });
  });

  // ── 6. Type safety (compile-time checks) ────

  describe('type safety', () => {
    it('FieldMapping type is used in properties output', () => {
      const mapping = createIndexMapping()
        .text('title', { keyword: true })
        .keyword('status', { ignoreAbove: 256 })
        .date('createdAt', { format: 'epoch_millis' })
        .integer('count', { coerce: false })
        .build();

      const props = mapping.mappings.properties;
      expect(props.title.type).toBe('text');
      expect(props.title.fields!.exact.type).toBe('keyword');
      expect(props.status.ignore_above).toBe(256);
      expect(props.createdAt.format).toBe('epoch_millis');
      expect(props.count.coerce).toBe(false);
    });
  });

  // ── Comprehensive integration test ──────────

  it('builds a fully configured index mapping', () => {
    const mapping = createIndexMapping()
      .settings({
        numberOfShards: 3,
        numberOfReplicas: 1,
        maxNgramDiff: 5,
        analysis: {
          analyzer: {
            ngram_analyzer: { type: 'custom', tokenizer: 'ngram' },
          },
        },
      })
      .dynamic('strict')
      .source({ includes: ['title', 'body'], excludes: ['raw'] })
      .text('title', {
        keyword: true,
        analyzer: 'ngram_analyzer',
        fields: { ngram: { type: 'text', analyzer: 'ngram_analyzer' } },
      })
      .text('body', { copyTo: 'searchField' })
      .keyword('status', { ignoreAbove: 256, normalizer: 'lowercase' })
      .date('createdAt', { format: 'yyyy-MM-dd' })
      .integer('viewCount', { nullValue: 0, coerce: false })
      .boolean('isPublished', { docValues: false })
      .nested('comments', { dynamic: 'strict' }, (b) => {
        b.text('content').keyword('author');
      })
      .object('metadata', { enabled: false }, (b) => {
        b.keyword('source');
      })
      .disabled('rawData')
      .build();

    expect(mapping.mappings.dynamic).toBe('strict');
    expect(mapping.mappings._source).toEqual({
      includes: ['title', 'body'],
      excludes: ['raw'],
    });
    expect(mapping.mappings.properties.title.fields).toEqual({
      exact: { type: 'keyword' },
      ngram: { type: 'text', analyzer: 'ngram_analyzer' },
    });
    expect(mapping.mappings.properties.body.copy_to).toBe('searchField');
    expect(mapping.mappings.properties.status.normalizer).toBe('lowercase');
    expect(mapping.mappings.properties.viewCount.null_value).toBe(0);
    expect(mapping.mappings.properties.isPublished.doc_values).toBe(false);
    expect(mapping.mappings.properties.comments.dynamic).toBe('strict');
    expect(mapping.mappings.properties.metadata.enabled).toBe(false);
    expect(mapping.mappings.properties.rawData.enabled).toBe(false);
    expect(Object.keys(mapping.mappings.properties)).toHaveLength(9);
  });
});
