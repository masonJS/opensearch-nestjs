// Self-defined types for v2/v3 compatibility (no deep imports from opensearch client)

// --- Query DSL ---

/**
 * Term query — searches for an exact value match.
 * Not analyzed, so best suited for `keyword` fields.
 *
 * @example
 * ```ts
 * builder.term('status', 'active');
 * ```
 */
export interface TermQuery {
  value: TermValue;
  boost?: number;
}

/**
 * Match query — performs full-text search.
 * The query string is analyzed (tokenized) before matching.
 *
 * @example
 * ```ts
 * builder.match('title', 'opensearch guide');
 * ```
 */
export interface MatchQuery {
  query: string;
  boost?: number;
  analyzer?: string;
  operator?: 'and' | 'or';
  fuzziness?: string | number;
  prefix_length?: number;
  max_expansions?: number;
}

/**
 * Wildcard query — pattern-based search using `*` and `?`.
 * `*` matches zero or more characters; `?` matches exactly one character.
 *
 * @example
 * ```ts
 * builder.wildcard('name', 'open*');
 * ```
 */
export interface WildcardQuery {
  value: string;
  boost?: number;
}

/**
 * Range query — filters by numeric or date ranges.
 * Combine `gte` (>=), `gt` (>), `lte` (<=), and `lt` (<) as needed.
 *
 * @example
 * ```ts
 * builder.range('price', { gte: 100, lte: 500 });
 * builder.range('createdAt', { gte: '2024-01-01', format: 'yyyy-MM-dd' });
 * ```
 */
export interface RangeQuery {
  gte?: string | number;
  gt?: string | number;
  lte?: string | number;
  lt?: string | number;
  format?: string;
  time_zone?: string;
  boost?: number;
}

/** @deprecated Use `RangeQuery` instead. */
export type Range = RangeQuery;

/**
 * Multi-match query — searches across multiple fields simultaneously.
 * The scoring strategy varies depending on the `type` option.
 *
 * @example
 * ```ts
 * builder.multiMatch('opensearch', ['title', 'description'], 'best_fields');
 * ```
 */
export interface MultiMatchQuery {
  query: string;
  fields: string[];
  type?: MultiMatchType;
  boost?: number;
  analyzer?: string;
  operator?: 'and' | 'or';
  fuzziness?: string | number;
}

/**
 * Exists query — matches documents where the given field has a value.
 *
 * @example
 * ```ts
 * builder.exists('email');
 * ```
 */
export interface ExistsQuery {
  field: string;
}

/**
 * Top-level query container for the OpenSearch Query DSL.
 * Each property corresponds to a supported query type.
 * Additional query types (e.g. `nested`, `function_score`) are allowed
 * via the index signature.
 */
export interface Query {
  term?: Record<string, TermQuery>;
  terms?: Record<string, TermValue[]>;
  match?: Record<string, MatchQuery>;
  match_all?: Record<string, never>;
  match_phrase?: Record<string, MatchQuery>;
  wildcard?: Record<string, WildcardQuery>;
  range?: Record<string, RangeQuery>;
  exists?: ExistsQuery;
  bool?: BoolQuery;
  multi_match?: MultiMatchQuery;
  [key: string]: any;
}

// --- Highlight ---

/**
 * Per-field highlight options (snake_case, matching the OpenSearch REST API).
 * Used to configure how matched text is emphasized in search results.
 */
export interface HighlightFieldOption {
  boundary_scanner?: 'chars' | 'sentence' | 'word';
  boundary_scanner_locale?: string;
  boundary_chars?: string;
  boundary_max_scan?: number;
  fragment_size?: number;
  number_of_fragments?: number;
  order?: 'score';
  no_match_size?: number;
  highlight_query?: Query;
  matched_fields?: string[];
  type?: 'plain' | 'fvh' | 'unified';
  pre_tags?: string[];
  post_tags?: string[];
}

// --- Common ---

/**
 * Sort values array used with `search_after` for deep pagination.
 * Pass the last document's sort values from the previous page to fetch the next.
 */
export type SearchAfter = (boolean | undefined | number | string)[];

/** Allowed value types for term-level queries. */
export type TermValue = string | number | boolean;

/**
 * Matching strategy for multi-match queries.
 *
 * - `best_fields` — score from the single best-matching field (default)
 * - `most_fields` — higher score when more fields match
 * - `cross_fields` — treats multiple fields as one large field
 * - `phrase` — phrase matching across fields
 * - `phrase_prefix` — phrase prefix matching (useful for autocomplete)
 * - `bool_prefix` — each token is searched as an individual prefix
 */
export type MultiMatchType =
  | 'best_fields'
  | 'most_fields'
  | 'cross_fields'
  | 'phrase'
  | 'phrase_prefix'
  | 'bool_prefix';

/**
 * Type-safe multi-match field configuration.
 * Field names are constrained to the keys of the index document type `T`.
 *
 * @typeParam T - Index document type
 */
export type MultiMatchField<T> = {
  field: keyof T | FlattenedKeys<T>;
  boost?: number;
};

/**
 * Highlight field configuration (camelCase).
 * Used by the builder API and internally converted to the snake_case
 * {@link HighlightFieldOption} format.
 */
export type HighlightFieldConfig = {
  boundaryScanner?: 'chars' | 'sentence' | 'word';
  boundaryScannerLocale?: string;
  boundaryChars?: string;
  boundaryMaxScan?: number;
  fragmentSize?: number;
  numberOfFragments?: number;
  order?: 'score' | 'none';
  noMatchSize?: number;
  highlightQuery?: Query;
  matchedFields?: string[];
  type?: 'plain' | 'fvh' | 'unified';
};

/**
 * Highlight field entry that pairs a target field `name` with its
 * highlight options.
 *
 * @typeParam T - Index document type
 */
export type HighlightFieldEntry<T> = {
  name: keyof T;
} & HighlightFieldConfig;

/**
 * OpenSearch highlight configuration.
 * Wraps matched text in `pre_tags` / `post_tags` within search results.
 *
 * @example
 * ```ts
 * builder.highlight([{ name: 'title', fragmentSize: 150 }], '<em>', '</em>');
 * ```
 */
export type Highlight = {
  pre_tags?: string[];
  post_tags?: string[];
  fields: Record<string, HighlightFieldOption>;
  highlight_query?: Query;
};

/**
 * Top-level structure of an OpenSearch search request.
 * Also the return type of `OpensearchQueryBuilder.build()`.
 */
export interface OpenSearchQuery {
  size?: number;
  from?: number;
  query?: Query;
  sort?: Record<string, { order: 'asc' | 'desc' }>[];
  _source?: string[] | boolean;
  search_after?: SearchAfter;
  highlight?: Highlight;
}

/**
 * Bool query — combines multiple queries with boolean logic.
 *
 * - `must` — AND conditions (contributes to score)
 * - `filter` — AND conditions (no score impact, cacheable)
 * - `should` — OR conditions
 * - `must_not` — NOT conditions
 *
 * @example
 * ```ts
 * builder
 *   .must(q => q.match('status', 'active'))
 *   .filter(q => q.range('price', { gte: 100 }))
 *   .should(q => q.term('featured', true));
 * ```
 */
export interface BoolQuery {
  adjust_pure_negative?: boolean;
  filter?: Query[];
  minimum_should_match?: number | string;
  must?: Query[];
  must_not?: Query[];
  should?: Query[];
}

/**
 * Base interface for index documents.
 * Extend this when defining custom document types.
 *
 * @example
 * ```ts
 * interface Product extends IndexDocument {
 *   name: string;
 *   price: number;
 *   category: string;
 * }
 * ```
 */
export interface IndexDocument {
  [key: string]: any;
}

type NestedKeys<T> = {
  [K in keyof T]: T[K] extends object
    ? `${string & K}.${string & keyof T[K]}`
    : never;
}[keyof T];

/**
 * Union of all keys of document type `T`, including nested keys
 * in dot notation (e.g. `'address.city'`).
 *
 * @typeParam T - Index document type
 */
export type FlattenedKeys<T> = keyof T | NestedKeys<T>;
