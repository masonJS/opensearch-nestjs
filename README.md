# opensearch-nestjs

A [NestJS](https://nestjs.com/) module for [OpenSearch](https://opensearch.org/) with a type-safe, fluent query builder.

## Features

- NestJS dynamic module with `forRoot` / `forRootAsync`
- Type-safe fluent query builder with full-text search, term, range, wildcard, bool, and multi-match support
- Nested field path support via `FlattenedKeys<T>` (e.g. `'metadata.author'`)
- Typed search responses with highlight utilities
- CRUD and bulk operations (create, update, upsert, delete)
- Index management (create, delete, put mapping)
- Cursor-based pagination (`search_after`)
- Conditional query building (`when`, `whenElse`, `each`)

## Installation

```bash
npm install opensearch-nestjs
```

### Peer Dependencies

```bash
npm install @opensearch-project/opensearch @nestjs/common @nestjs/core reflect-metadata
```

> **Note:** Compatible with `@opensearch-project/opensearch` v2.x and v3.x.

## Quick Start

### 1. Register the module

```typescript
import { Module } from '@nestjs/common';
import { OpensearchModule } from 'opensearch-nestjs';

@Module({
  imports: [
    OpensearchModule.forRoot({
      node: 'http://localhost:9200',
      auth: { username: 'admin', password: 'admin' }, // optional
    }),
  ],
})
export class AppModule {}
```

**Async configuration** (e.g. with `ConfigService`):

```typescript
OpensearchModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    node: config.get('OPENSEARCH_NODE'),
    auth: {
      username: config.get('OPENSEARCH_USERNAME'),
      password: config.get('OPENSEARCH_PASSWORD'),
    },
  }),
});
```

### 2. Inject and use the services

```typescript
import { Injectable } from '@nestjs/common';
import { OpensearchSearchService, createQuery } from 'opensearch-nestjs';

interface Article {
  title: string;
  body: string;
  category: string;
  createdAt: Date;
}

@Injectable()
export class ArticleSearchService {
  constructor(private readonly searchService: OpensearchSearchService) {}

  async search(keyword: string, category?: string) {
    const query = createQuery<Article>()
      .bool((bool) => {
        bool
          .must((must) => {
            must.match('title', keyword);
          })
          .when(!!category, (b) => {
            b.filter((filter) => {
              filter.term('category', category!);
            });
          });
      })
      .sortBy('createdAt', 'desc')
      .size(20)
      .build();

    return this.searchService.search<Article>('articles', query);
  }
}
```

## API Reference

### Module

| Method                                   | Description                  |
| ---------------------------------------- | ---------------------------- |
| `OpensearchModule.forRoot(options)`      | Register with static options |
| `OpensearchModule.forRootAsync(options)` | Register with async factory  |

Both methods export `OpensearchSearchService`, `OpensearchDocumentService`, `OpensearchIndexService`, and the OpenSearch `Client`.

### OpensearchSearchService

| Method                    | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `search<T>(index, query)` | Search documents. Accepts single index or array of indices |
| `count(index, query?)`    | Count documents, optionally filtered by query              |

### OpensearchDocumentService

#### CRUD

| Method                      | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `create<T>(index, body)`    | Index a new document                            |
| `getOne<T>(index, id)`      | Get document by ID, returns `null` if not found |
| `update<T>(index, id, doc)` | Partial update                                  |
| `upsert<T>(index, id, doc)` | Update or insert (`doc_as_upsert`)              |
| `delete(index, id)`         | Delete by ID (no-op if not found)               |

#### Bulk Operations

| Method                            | Description                     |
| --------------------------------- | ------------------------------- |
| `bulkCreate<T>(index, documents)` | Bulk index documents            |
| `bulkUpdate<T>(index, updates)`   | Bulk partial updates            |
| `bulkUpsert<T>(index, upserts)`   | Bulk upsert                     |
| `bulkDelete(index, ids)`          | Bulk delete by IDs              |
| `deleteByQuery(index, query)`     | Delete documents matching query |

### OpensearchIndexService

| Method                          | Description                            |
| ------------------------------- | -------------------------------------- |
| `create(index, body)`           | Create index (skips if already exists) |
| `delete(index)`                 | Delete index (no-op if not found)      |
| `putMapping(index, properties)` | Update index mapping                   |

### Query Builder

Create a query builder with `createQuery<T>()`:

```typescript
import { createQuery } from 'opensearch-nestjs';

const query = createQuery<MyDocument>()
  .bool((bool) => {
    bool
      .must((must) => {
        must.match('title', 'hello').match('body', 'world');
      })
      .filter((filter) => {
        filter
          .term('status', 'published')
          .range('createdAt', { gte: '2025-01-01' });
      })
      .should((should) => {
        should.term('featured', true);
      })
      .mustNot((mustNot) => {
        mustNot.term('hidden', true);
      });
  })
  .size(10)
  .from(0)
  .build();
```

#### Query Methods

| Method                             | Description                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `term(field, value, boost?)`       | Exact match on keyword field                                           |
| `match(field, query, boost?)`      | Full-text search                                                       |
| `wildcard(field, pattern, boost?)` | Wildcard pattern match                                                 |
| `range(field, range)`              | Range query (`gte`, `lte`, `gt`, `lt`, `format`, `time_zone`, `boost`) |
| `exists(field)`                    | Field existence check                                                  |
| `multiMatch(query, fields, type?)` | Multi-field full-text search                                           |
| `bool(builder)`                    | Bool query (`must`, `should`, `filter`, `mustNot`)                     |
| `setQuery(query)`                  | Set a raw query object directly                                        |

All field parameters accept both `keyof T` and nested dot-notation paths via `FlattenedKeys<T>`.

#### QueryCollectionBuilder

Within `must`, `should`, `filter`, and `mustNot` callbacks, additional methods are available:

| Method               | Description              |
| -------------------- | ------------------------ |
| `query(customQuery)` | Add a raw `Query` object |
| `bool(builder)`      | Nested bool query        |

#### Sorting

```typescript
// Simple
createQuery<T>().sortBy('createdAt', 'desc');

// Advanced
createQuery<T>().sort((sort) => {
  sort.score('desc').field('createdAt', 'desc');
});
```

#### Pagination

```typescript
// Offset-based
createQuery<T>().from(0).size(20);

// Cursor-based (search_after)
const result = await searchService.search<T>('index', query);
const nextQuery = createQuery<T>()
  .sortBy('createdAt', 'desc')
  .lastIdFromCursor(result.cursor)
  .size(20)
  .build();
```

| Method                      | Input                         | Description                       |
| --------------------------- | ----------------------------- | --------------------------------- |
| `.lastId(searchAfter)`      | `SearchAfter` (array)         | Pass sort values directly         |
| `.lastIdFromCursor(cursor)` | `string \| undefined \| null` | Parse from `result.cursor` string |

#### Highlight

```typescript
createQuery<T>()
  .bool((bool) => {
    bool.should((should) => {
      should.match('title', 'keyword');
    });
  })
  .highlight((h) => {
    h.tags(['<mark>'], ['</mark>'])
      .field('title', { fragmentSize: 150, numberOfFragments: 3 })
      .field('body')
      .fields([{ name: 'title' }, { name: 'body', fragmentSize: 200 }])
      .highlightQuery({ match: { title: { query: 'keyword' } } });
  });
```

| Method                    | Description                           |
| ------------------------- | ------------------------------------- |
| `field(name, options?)`   | Add a single highlight field          |
| `fields(entries)`         | Add multiple highlight fields at once |
| `tags(preTags, postTags)` | Set highlight tags                    |
| `highlightQuery(query)`   | Set a separate query for highlighting |

#### Source Filtering

```typescript
// Include specific fields only
createQuery<T>().source(['title', 'createdAt']);

// Exclude _source entirely
createQuery<T>().source(false);
```

#### Conditional Building

```typescript
createQuery<T>()
  // Apply only when condition is true
  .when(!!category, (q) => {
    q.term('category', category!);
  })
  // Apply different builders based on condition
  .whenElse(
    sortByDate,
    (q) => q.sortBy('createdAt', 'desc'),
    (q) => q.sortBy('_score', 'desc'),
  )
  // Iterate over items
  .each(tags, (q, tag) => {
    q.term('tags', tag);
  });
```

`when`, `whenElse`, and `each` are available on `OpensearchQueryBuilder`, `BoolQueryBuilder`, and `QueryCollectionBuilder`.

### Search Response

```typescript
const result = await searchService.search<Article>('articles', query);

result.total; // Total number of matching documents
result.hits; // Array of SearchHitResponse<T>
result.isEmpty; // true if no results
result.cursor; // Cursor string for next page (search_after)

// Each hit
result.hits[0].id; // Document ID
result.hits[0].source; // Document body (typed as T)
result.hits[0].score; // Relevance score
result.hits[0].sort; // Sort values (SearchAfter)
result.hits[0].index; // Index name

// Highlight utilities
result.hits[0].getHighlight('title'); // string[] | undefined
result.hits[0].getHighlightFirst('title'); // First highlight fragment
result.hits[0].getHighlightSentence('title'); // Sentence containing <mark> tag
```

### Index Mapping Builder

Build OpenSearch index mappings with a fluent API using `createIndexMapping()`:

```typescript
import { createIndexMapping } from 'opensearch-nestjs';

const articleMapping = createIndexMapping()
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

await indexService.create('articles', articleMapping);
```

#### Field Methods

| Method                   | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `text(field, options?)`  | Text field. Options: `keyword`, `index`, `ignoreAbove`, `analyzer`, `searchAnalyzer` |
| `keyword(field)`         | Keyword field                                                                        |
| `date(field)`            | Date field                                                                           |
| `boolean(field)`         | Boolean field                                                                        |
| `integer(field)`         | Integer field                                                                        |
| `long(field)`            | Long field                                                                           |
| `float(field)`           | Float field                                                                          |
| `double(field)`          | Double field                                                                         |
| `nested(field, builder)` | Nested object with sub-fields                                                        |
| `object(field, builder)` | Object with sub-fields                                                               |
| `custom(field, mapping)` | Raw mapping for any type (e.g. `geo_point`)                                          |

#### Nested / Object Fields

```typescript
createIndexMapping()
  .nested('comments', (b) => {
    b.text('content').keyword('author').date('createdAt');
  })
  .object('metadata', (b) => {
    b.keyword('source').integer('version');
  })
  .build();
```

#### Settings with Custom Analysis

```typescript
createIndexMapping()
  .settings({
    numberOfShards: 1,
    numberOfReplicas: 0,
    maxNgramDiff: 3,
    analysis: {
      tokenizer: {
        bigram: { type: 'ngram', min_gram: 2, max_gram: 5 },
      },
      analyzer: {
        bigram_analyzer: { type: 'custom', tokenizer: 'bigram' },
      },
    },
  })
  .text('title', { analyzer: 'bigram_analyzer', keyword: true })
  .build();
```

## Development

```bash
# Start OpenSearch
docker compose up -d

# Run tests
npm test

# Build
npm run build
```

## Requirements

- Node.js >= 18
- NestJS >= 10
- OpenSearch >= 2.x

## License

MIT
