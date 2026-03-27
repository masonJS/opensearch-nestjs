// Self-defined types for v2/v3 compatibility (no deep imports from opensearch client)

// --- Query DSL ---

export interface TermQuery {
  value: TermValue;
  boost?: number;
}

export interface MatchQuery {
  query: string;
  boost?: number;
  analyzer?: string;
  operator?: 'and' | 'or';
  fuzziness?: string | number;
  prefix_length?: number;
  max_expansions?: number;
}

export interface WildcardQuery {
  value: string;
  boost?: number;
}

export interface RangeQuery {
  gte?: string | number;
  gt?: string | number;
  lte?: string | number;
  lt?: string | number;
  format?: string;
  time_zone?: string;
  boost?: number;
}

export type Range = RangeQuery;

export interface MultiMatchQuery {
  query: string;
  fields: string[];
  type?: MultiMatchType;
  boost?: number;
  analyzer?: string;
  operator?: 'and' | 'or';
  fuzziness?: string | number;
}

export interface ExistsQuery {
  field: string;
}

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
  // Additional query types (nested, function_score, etc.) are supported
  // via the index signature below.
  [key: string]: any;
}

// --- Range ---

// (Range is aliased above as RangeQuery)

// --- Highlight ---

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

export type SearchAfter = (boolean | undefined | number | string)[];

export type TermValue = string | number | boolean;

export type MultiMatchType =
  | 'best_fields'
  | 'most_fields'
  | 'cross_fields'
  | 'phrase'
  | 'phrase_prefix'
  | 'bool_prefix';

export type MultiMatchField<T> = {
  field: keyof T | FlattenedKeys<T>;
  boost?: number;
};

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

export type HighlightFieldEntry<T> = {
  name: keyof T;
} & HighlightFieldConfig;

export type Highlight = {
  pre_tags?: string[];
  post_tags?: string[];
  fields: Record<string, HighlightFieldOption>;
  highlight_query?: Query;
};

export interface OpenSearchQuery {
  size?: number;
  from?: number;
  query?: Query;
  sort?: Record<string, { order: 'asc' | 'desc' }>[];
  _source?: string[] | boolean;
  search_after?: SearchAfter;
  highlight?: Highlight;
}

export interface BoolQuery {
  adjust_pure_negative?: boolean;
  filter?: Query[];
  minimum_should_match?: number | string;
  must?: Query[];
  must_not?: Query[];
  should?: Query[];
}

// Base interface for index documents
export interface IndexDocument {
  [key: string]: any;
}

type NestedKeys<T> = {
  [K in keyof T]: T[K] extends object
    ? `${string & K}.${string & keyof T[K]}`
    : never;
}[keyof T];

export type FlattenedKeys<T> = keyof T | NestedKeys<T>;
