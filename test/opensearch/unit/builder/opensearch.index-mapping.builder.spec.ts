import { describe, expect, it } from 'vitest';
import { createIndexMapping } from '../../../src/index.js';

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
      .text('title', { analyzer: 'custom_analyzer', searchAnalyzer: 'standard' })
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
});
