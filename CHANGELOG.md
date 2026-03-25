# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-03-25

Initial public release as `opensearch-nestjs`. Extracted from internal `@us-all/us-opensearch` package.

### Added

- `OpensearchModule` with `forRoot()` and `forRootAsync()` registration
- `OpensearchService` with search, CRUD, bulk, and index management operations
- Type-safe `OpenSearchQueryBuilder` with `createQuery<T>()`
  - Query methods: `term`, `match`, `wildcard`, `range`, `exists`, `multiMatch`
  - Bool query: `must`, `should`, `filter`, `mustNot` with `minimumShouldMatch`
  - Sorting: `sortBy`, `sort` (with `SortBuilder` including `score()`)
  - Pagination: `from`, `size`, `lastId`, `lastIdFromCursor`
  - Highlight: `field`, `fields`, `tags`, `highlightQuery`
  - Source filtering: `source`
  - Conditional building: `when`, `whenElse`, `each`
- `SearchResponse<T>` with `total`, `hits`, `isEmpty`, `cursor`
- `SearchHitResponse<T>` with `getHighlight`, `getHighlightFirst`, `getHighlightSentence`
- `CreateIndexResponse`
- `IndexMappingBuilder` with `createIndexMapping()` for fluent index mapping definitions
  - Field types: `text`, `keyword`, `date`, `boolean`, `integer`, `long`, `float`, `double`
  - Composite types: `nested`, `object`, `custom`
  - Settings: shards, replicas, analysis configuration

### Changed

- Package name: `@us-all/us-opensearch` -> `opensearch-nestjs`
- Registry: GitHub Packages -> npmjs.com
- `@opensearch-project/opensearch` moved from `dependencies` to `peerDependencies` (`>=2.0.0`)
- Self-defined types replace deep imports for v2/v3 client compatibility
- Removed `class-transformer` dependency (responses use plain JS mapping)
- Removed domain-specific index models (ContentIndex, PostIndex) and fixtures
