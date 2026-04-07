import {
  BoolQuery,
  FlattenedKeys,
  Highlight,
  HighlightFieldConfig,
  HighlightFieldEntry,
  HighlightFieldOption,
  IndexDocument,
  MultiMatchField,
  MultiMatchType,
  OpenSearchQuery,
  Query,
  Range,
  SearchAfter,
  TermValue,
} from '../type/opensearch.type.js';

/**
 * Fluent, type-safe builder for constructing OpenSearch search queries.
 *
 * Field names are validated at compile time via the generic parameter `T`,
 * including nested fields through {@link FlattenedKeys}.
 *
 * @typeParam T - The index document type whose keys constrain field arguments
 *
 * @example
 * ```ts
 * const query = createQuery<Product>()
 *   .size(20)
 *   .bool((b) =>
 *     b.must((m) => m.match('title', 'opensearch'))
 *      .filter((f) => f.range('price', { gte: 100 }))
 *   )
 *   .sortBy('createdAt', 'desc')
 *   .build();
 * ```
 */
export class OpensearchQueryBuilder<T extends IndexDocument> {
  private query: OpenSearchQuery = {};

  /**
   * Sets the maximum number of hits to return.
   *
   * @param size - Number of results (default is OpenSearch's own default of 10)
   */
  size(size: number): OpensearchQueryBuilder<T> {
    this.query.size = size;
    return this;
  }

  /**
   * Sets the starting offset for pagination.
   * Use with {@link size} for offset-based pagination.
   *
   * @param from - Zero-based offset
   */
  from(from: number): OpensearchQueryBuilder<T> {
    this.query.from = from;
    return this;
  }

  /**
   * Adds a compound bool query using a {@link BoolQueryBuilder} callback.
   *
   * @param builder - Callback receiving a {@link BoolQueryBuilder} to configure must/should/filter/mustNot clauses
   *
   * @example
   * ```ts
   * queryBuilder.bool((b) =>
   *   b.must((m) => m.term('status', 'active'))
   *    .filter((f) => f.range('price', { gte: 10 }))
   * );
   * ```
   */
  bool(
    builder: (boolBuilder: BoolQueryBuilder<T>) => void,
  ): OpensearchQueryBuilder<T> {
    const boolBuilder = new BoolQueryBuilder<T>();
    builder(boolBuilder);
    this.query.query = { bool: boolBuilder.build() };
    return this;
  }

  /**
   * Adds multi-field sorting via a {@link SortBuilder} callback.
   *
   * @param builder - Callback receiving a {@link SortBuilder}
   *
   * @example
   * ```ts
   * queryBuilder.sort((s) => s.score('desc').field('createdAt', 'desc'));
   * ```
   */
  sort(
    builder: (sortBuilder: SortBuilder<T>) => void,
  ): OpensearchQueryBuilder<T> {
    const sortBuilder = new SortBuilder<T>();
    builder(sortBuilder);
    this.query.sort = sortBuilder.build();
    return this;
  }

  /**
   * Adds a single-field sort. For multi-field sorting, use {@link sort} instead.
   *
   * @param field - Field to sort by
   * @param order - Sort direction (defaults to `'desc'`)
   */
  sortBy<K extends keyof T>(
    field: K,
    order: 'asc' | 'desc' = 'desc',
  ): OpensearchQueryBuilder<T> {
    this.query.sort = [{ [field as string]: { order } }];
    return this;
  }

  /**
   * Configures search result highlighting via a {@link HighlightBuilder} callback.
   *
   * @param builder - Callback receiving a {@link HighlightBuilder}
   *
   * @example
   * ```ts
   * queryBuilder.highlight((h) =>
   *   h.field('title', { fragmentSize: 150 })
   *    .tags(['<mark>'], ['</mark>'])
   * );
   * ```
   */
  highlight(
    builder: (highlightBuilder: HighlightBuilder<T>) => void,
  ): OpensearchQueryBuilder<T> {
    const highlightBuilder = new HighlightBuilder<T>();
    builder(highlightBuilder);
    this.query.highlight = highlightBuilder.build();
    return this;
  }

  /**
   * Adds a term query for exact-value matching on a field.
   *
   * @param field - Field name (type-checked against `T`)
   * @param value - Exact value to match
   * @param boost - Optional relevance boost
   */
  term<K extends keyof T>(
    field: K,
    value: TermValue,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  term<P extends FlattenedKeys<T>>(
    field: P,
    value: TermValue,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  term(
    field: string,
    value: TermValue,
    boost?: number,
  ): OpensearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.term = {
      [field]: { value, ...(boost != null && { boost }) },
    };
    return this;
  }

  /**
   * Adds a wildcard query using `*` (zero or more chars) and `?` (single char) patterns.
   *
   * @param field - Field name
   * @param value - Wildcard pattern
   * @param boost - Optional relevance boost
   */
  wildcard<K extends keyof T>(
    field: K,
    value: string,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  wildcard<P extends FlattenedKeys<T>>(
    field: P,
    value: string,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  wildcard(
    field: string,
    value: string,
    boost?: number,
  ): OpensearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.wildcard = {
      [field]: { value, ...(boost != null && { boost }) },
    };
    return this;
  }

  /**
   * Adds a full-text match query. The query string is analyzed before matching.
   *
   * @param field - Field name
   * @param query - Text to search for
   * @param boost - Optional relevance boost
   */
  match<K extends keyof T>(
    field: K,
    query: string,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  match<P extends FlattenedKeys<T>>(
    field: P,
    query: string,
    boost?: number,
  ): OpensearchQueryBuilder<T>;

  match(
    field: string,
    query: string,
    boost?: number,
  ): OpensearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.match = {
      [field]: {
        query,
        ...(boost != null && { boost }),
      },
    };
    return this;
  }

  /**
   * Adds a range query for numeric or date fields.
   *
   * @param field - Field name
   * @param range - Range bounds (`gte`, `gt`, `lte`, `lt`, `format`, etc.)
   */
  range<K extends keyof T>(field: K, range: Range): OpensearchQueryBuilder<T>;

  range<P extends FlattenedKeys<T>>(
    field: P,
    range: Range,
  ): OpensearchQueryBuilder<T>;

  range(field: string, range: Range): OpensearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.range = { [field]: range };
    return this;
  }

  /**
   * Adds an exists query — matches documents where the field has a non-null value.
   *
   * @param field - Field name
   */
  exists<K extends keyof T>(field: K): OpensearchQueryBuilder<T>;

  exists<P extends FlattenedKeys<T>>(field: P): OpensearchQueryBuilder<T>;

  exists(field: string): OpensearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.exists = { field };
    return this;
  }

  /**
   * Sets `search_after` for cursor-based deep pagination.
   * Pass the sort values from the last hit of the previous page.
   *
   * @param lastId - Sort values array from the previous page's last document
   */
  lastId(lastId: SearchAfter): OpensearchQueryBuilder<T> {
    this.query.search_after = lastId;
    return this;
  }

  /**
   * Sets `search_after` from a JSON cursor string (as returned by {@link SearchResponse.cursor}).
   * No-ops if the cursor is `null` or `undefined`.
   *
   * @param cursor - JSON-serialized sort values, or `null`/`undefined` for the first page
   * @throws Error if the cursor string is not valid JSON
   */
  lastIdFromCursor(cursor: string | undefined | null): this {
    if (!cursor) {
      return this;
    }
    try {
      this.query.search_after = JSON.parse(cursor) as SearchAfter;
      return this;
    } catch {
      throw new Error(`Invalid cursor format: ${cursor}`);
    }
  }

  /**
   * Adds a multi-match query that searches across multiple fields.
   *
   * @param query - Text to search for
   * @param fields - Array of field configurations with optional boost
   * @param type - Scoring strategy (defaults to `'best_fields'`)
   */
  multiMatch(
    query: string,
    fields: MultiMatchField<T>[],
    type: MultiMatchType = 'best_fields',
  ): OpensearchQueryBuilder<T> {
    const fieldsWithBoost = fields.map(({ field, boost }) =>
      boost !== undefined ? `${String(field)}^${boost}` : String(field),
    );
    const multiMatchQuery: Query = {
      multi_match: { query, fields: fieldsWithBoost, type },
    };

    if (!this.query.query) {
      this.query.query = multiMatchQuery;
    } else if (this.query.query.bool) {
      const boolQuery = this.query.query.bool as BoolQuery;
      if (!boolQuery.must) {
        boolQuery.must = [];
      }
      boolQuery.must.push(multiMatchQuery);
    } else {
      this.query.query = {
        bool: { must: [this.query.query, multiMatchQuery] },
      };
    }
    return this;
  }

  /**
   * Controls which fields are included in `_source`.
   * Pass an array of field names to include, or `false` to disable `_source` entirely.
   *
   * @param fields - Field names to include, or `boolean` to enable/disable
   */
  source(fields?: (keyof T)[] | boolean): OpensearchQueryBuilder<T> {
    this.query._source = fields as string[] | boolean;
    return this;
  }

  /**
   * Conditionally applies a builder callback when the condition is `true`.
   * Useful for optional query clauses without breaking the fluent chain.
   *
   * @param condition - Boolean condition
   * @param builder - Callback to apply when condition is truthy
   *
   * @example
   * ```ts
   * createQuery<Product>()
   *   .when(!!keyword, (q) => q.match('title', keyword!))
   *   .build();
   * ```
   */
  when<Q extends this>(
    this: Q,
    condition: boolean,
    builder: (q: Q) => void,
  ): Q {
    if (condition) {
      builder(this);
    }
    return this;
  }

  /**
   * Conditionally applies one of two builder callbacks based on the condition.
   *
   * @param condition - Boolean condition
   * @param trueBuilder - Callback applied when `true`
   * @param falseBuilder - Callback applied when `false`
   */
  whenElse<Q extends this>(
    this: Q,
    condition: boolean,
    trueBuilder: (q: Q) => void,
    falseBuilder: (q: Q) => void,
  ): Q {
    if (condition) {
      trueBuilder(this);
    } else {
      falseBuilder(this);
    }
    return this;
  }

  /**
   * Iterates over an array and applies the builder callback for each item.
   * No-ops if the array is `null`, `undefined`, or empty.
   *
   * @param items - Array to iterate over
   * @param builder - Callback receiving the query builder, current item, and index
   */
  each<I>(
    items: I[] | null | undefined,
    builder: (q: this, item: I, index: number) => void,
  ): this {
    if (!items?.length) {
      return this;
    }
    items.forEach((item, index) => builder(this, item, index));
    return this;
  }

  /**
   * Builds and returns the final {@link OpenSearchQuery} object,
   * ready to be passed to {@link OpensearchSearchService.search}.
   */
  build(): OpenSearchQuery {
    return this.query;
  }

  /**
   * Directly sets a raw query object, bypassing the builder methods.
   * Use this for query types not yet supported by the builder API.
   *
   * @param query - Raw OpenSearch query DSL object
   */
  setQuery(query: any): OpensearchQueryBuilder<T> {
    this.query.query = query;
    return this;
  }
}

/**
 * Builder for constructing bool query clauses (`must`, `should`, `must_not`, `filter`).
 *
 * @typeParam T - The index document type
 *
 * @example
 * ```ts
 * queryBuilder.bool((b) =>
 *   b.must((m) => m.match('title', 'guide'))
 *    .filter((f) => f.term('status', 'published'))
 *    .should((s) => s.term('featured', true))
 *    .minimumShouldMatch(1)
 * );
 * ```
 */
export class BoolQueryBuilder<T extends IndexDocument> {
  private boolQuery: BoolQuery = {};

  /**
   * Adds `must` clauses — all must match (AND). Contributes to relevance score.
   *
   * @param builder - Callback receiving a {@link QueryCollectionBuilder}
   */
  must(
    builder: (mustBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const mustBuilder = new QueryCollectionBuilder<T>();
    builder(mustBuilder);
    this.boolQuery.must = mustBuilder.getQueries();
    return this;
  }

  /**
   * Adds `should` clauses — at least one should match (OR).
   * Use with {@link minimumShouldMatch} to require a specific number.
   *
   * @param builder - Callback receiving a {@link QueryCollectionBuilder}
   */
  should(
    builder: (shouldBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const shouldBuilder = new QueryCollectionBuilder<T>();
    builder(shouldBuilder);
    this.boolQuery.should = shouldBuilder.getQueries();
    return this;
  }

  /**
   * Adds `must_not` clauses — none must match (NOT). Does not affect scoring.
   *
   * @param builder - Callback receiving a {@link QueryCollectionBuilder}
   */
  mustNot(
    builder: (mustNotBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const mustNotBuilder = new QueryCollectionBuilder<T>();
    builder(mustNotBuilder);
    this.boolQuery.must_not = mustNotBuilder.getQueries();
    return this;
  }

  /**
   * Adds `filter` clauses — all must match (AND), but without scoring.
   * Filter clauses are cached for better performance.
   *
   * @param builder - Callback receiving a {@link QueryCollectionBuilder}
   */
  filter(
    builder: (filterBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const filterBuilder = new QueryCollectionBuilder<T>();
    builder(filterBuilder);
    this.boolQuery.filter = filterBuilder.getQueries();
    return this;
  }

  /**
   * Sets the minimum number of `should` clauses that must match.
   *
   * @param minimum - Minimum number of matching should clauses
   */
  minimumShouldMatch(minimum: number): BoolQueryBuilder<T> {
    this.boolQuery.minimum_should_match = minimum;
    return this;
  }

  /** @see OpensearchQueryBuilder.when */
  when<Q extends this>(
    this: Q,
    condition: boolean,
    builder: (q: Q) => void,
  ): Q {
    if (condition) {
      builder(this);
    }
    return this;
  }

  /** @see OpensearchQueryBuilder.whenElse */
  whenElse<Q extends this>(
    this: Q,
    condition: boolean,
    trueBuilder: (q: Q) => void,
    falseBuilder: (q: Q) => void,
  ): Q {
    if (condition) {
      trueBuilder(this);
    } else {
      falseBuilder(this);
    }
    return this;
  }

  /** @see OpensearchQueryBuilder.each */
  each<I>(
    items: I[] | null | undefined,
    builder: (q: this, item: I, index: number) => void,
  ): this {
    if (!items?.length) {
      return this;
    }
    items.forEach((item, index) => builder(this, item, index));
    return this;
  }

  /** Builds and returns the {@link BoolQuery} object. */
  build(): BoolQuery {
    return this.boolQuery;
  }
}

/**
 * Builder for constructing sort clauses.
 *
 * @typeParam T - The index document type
 *
 * @example
 * ```ts
 * queryBuilder.sort((s) =>
 *   s.score('desc')
 *    .field('createdAt', 'desc')
 *    .field('title', 'asc')
 * );
 * ```
 */
export class SortBuilder<T extends IndexDocument> {
  private sortFields: any[] = [];

  /**
   * Adds a field-based sort clause.
   *
   * @param fieldName - Field to sort by
   * @param order - Sort direction (defaults to `'desc'`)
   */
  field<K extends keyof T>(
    fieldName: K,
    order: 'asc' | 'desc' = 'desc',
  ): SortBuilder<T> {
    this.sortFields.push({ [fieldName as string]: { order } });
    return this;
  }

  /**
   * Adds a `_score`-based sort clause for relevance sorting.
   *
   * @param order - Sort direction (defaults to `'desc'`)
   */
  score(order: 'asc' | 'desc' = 'desc'): SortBuilder<T> {
    this.sortFields.push({ _score: { order } });
    return this;
  }

  /** Builds and returns the sort array. */
  build(): any[] {
    return this.sortFields;
  }
}

/**
 * Builder for collecting multiple query clauses within a single bool context
 * (e.g. inside `must`, `should`, `filter`, or `must_not`).
 *
 * Provides the same query methods as {@link OpensearchQueryBuilder} but
 * accumulates queries into an array rather than overwriting a single query.
 *
 * @typeParam T - The index document type
 */
export class QueryCollectionBuilder<T extends IndexDocument> {
  private queries: Query[] = [];

  /**
   * Adds a term query for exact-value matching.
   *
   * @param field - Field name
   * @param value - Exact value to match
   * @param boost - Optional relevance boost
   */
  term<K extends keyof T>(
    field: K,
    value: TermValue,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  term<P extends FlattenedKeys<T>>(
    field: P,
    value: TermValue,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  term(
    field: string,
    value: TermValue,
    boost?: number,
  ): QueryCollectionBuilder<T> {
    this.queries.push({
      term: { [field]: { value, ...(boost != null && { boost }) } },
    });
    return this;
  }

  /**
   * Adds a wildcard query.
   *
   * @param field - Field name
   * @param value - Wildcard pattern (`*` and `?`)
   * @param boost - Optional relevance boost
   */
  wildcard<K extends keyof T>(
    field: K,
    value: string,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  wildcard<P extends FlattenedKeys<T>>(
    field: P,
    value: string,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  wildcard(
    field: string,
    value: string,
    boost?: number,
  ): QueryCollectionBuilder<T> {
    this.queries.push({
      wildcard: { [field]: { value, ...(boost != null && { boost }) } },
    });
    return this;
  }

  /**
   * Adds a full-text match query.
   *
   * @param field - Field name
   * @param query - Text to search for
   * @param boost - Optional relevance boost
   */
  match<K extends keyof T>(
    field: K,
    query: string,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  match<P extends FlattenedKeys<T>>(
    field: P,
    query: string,
    boost?: number,
  ): QueryCollectionBuilder<T>;

  match(
    field: string,
    query: string,
    boost?: number,
  ): QueryCollectionBuilder<T> {
    this.queries.push({
      match: {
        [field]: {
          query,
          ...(boost != null && { boost }),
        },
      },
    });
    return this;
  }

  /**
   * Adds a range query for numeric or date fields.
   *
   * @param field - Field name
   * @param range - Range bounds (`gte`, `gt`, `lte`, `lt`)
   */
  range<K extends keyof T>(field: K, range: Range): QueryCollectionBuilder<T>;

  range<P extends FlattenedKeys<T>>(
    field: P,
    range: Range,
  ): QueryCollectionBuilder<T>;

  range(field: string, range: Range): QueryCollectionBuilder<T> {
    this.queries.push({ range: { [field]: range } });
    return this;
  }

  /**
   * Adds an exists query.
   *
   * @param field - Field name that must have a non-null value
   */
  exists<K extends keyof T>(field: K): QueryCollectionBuilder<T>;

  exists<P extends FlattenedKeys<T>>(field: P): QueryCollectionBuilder<T>;

  exists(field: string): QueryCollectionBuilder<T> {
    this.queries.push({ exists: { field } });
    return this;
  }

  /**
   * Adds a nested bool query within this query collection.
   *
   * @param builder - Callback receiving a {@link BoolQueryBuilder}
   */
  bool(
    builder: (boolBuilder: BoolQueryBuilder<T>) => void,
  ): QueryCollectionBuilder<T> {
    const boolBuilder = new BoolQueryBuilder<T>();
    builder(boolBuilder);
    this.queries.push({ bool: boolBuilder.build() });
    return this;
  }

  /**
   * Adds a raw custom query object to the collection.
   * Use for query types not covered by the built-in methods.
   *
   * @param customQuery - Raw OpenSearch query DSL object
   */
  query(customQuery: Query): QueryCollectionBuilder<T> {
    this.queries.push(customQuery);
    return this;
  }

  /**
   * Adds a multi-match query that searches across multiple fields.
   *
   * @param query - Text to search for
   * @param fields - Array of field configurations with optional boost
   * @param type - Scoring strategy (defaults to `'best_fields'`)
   */
  multiMatch(
    query: string,
    fields: MultiMatchField<T>[],
    type: MultiMatchType = 'best_fields',
  ): QueryCollectionBuilder<T> {
    const fieldsWithBoost = fields.map(({ field, boost }) =>
      boost !== undefined ? `${String(field)}^${boost}` : String(field),
    );
    this.queries.push({
      multi_match: { query, fields: fieldsWithBoost, type },
    });
    return this;
  }

  /** @see OpensearchQueryBuilder.when */
  when<Q extends this>(
    this: Q,
    condition: boolean,
    builder: (q: Q) => void,
  ): Q {
    if (condition) {
      builder(this);
    }
    return this;
  }

  /** @see OpensearchQueryBuilder.whenElse */
  whenElse<Q extends this>(
    this: Q,
    condition: boolean,
    trueBuilder: (q: Q) => void,
    falseBuilder: (q: Q) => void,
  ): Q {
    if (condition) {
      trueBuilder(this);
    } else {
      falseBuilder(this);
    }
    return this;
  }

  /** @see OpensearchQueryBuilder.each */
  each<I>(
    items: I[] | null | undefined,
    builder: (q: this, item: I, index: number) => void,
  ): this {
    if (!items?.length) {
      return this;
    }

    items.forEach((item, index) => builder(this, item, index));
    return this;
  }

  /** Returns the accumulated query array. */
  getQueries(): Query[] {
    return this.queries;
  }
}

/**
 * Builder for configuring search result highlighting.
 *
 * @typeParam T - The index document type
 *
 * @example
 * ```ts
 * queryBuilder.highlight((h) =>
 *   h.field('title', { fragmentSize: 150, numberOfFragments: 3 })
 *    .field('description')
 *    .tags(['<mark>'], ['</mark>'])
 * );
 * ```
 */
export class HighlightBuilder<T extends IndexDocument> {
  private highlight: Highlight = { fields: {} };

  private static toHighlightFieldOption(
    config: HighlightFieldConfig,
  ): HighlightFieldOption {
    return {
      ...(config.boundaryScanner && {
        boundary_scanner: config.boundaryScanner,
      }),
      ...(config.boundaryScannerLocale && {
        boundary_scanner_locale: config.boundaryScannerLocale,
      }),
      ...(config.boundaryChars && { boundary_chars: config.boundaryChars }),
      ...(config.boundaryMaxScan != null && {
        boundary_max_scan: config.boundaryMaxScan,
      }),
      ...(config.fragmentSize != null && {
        fragment_size: config.fragmentSize,
      }),
      ...(config.numberOfFragments != null && {
        number_of_fragments: config.numberOfFragments,
      }),
      ...(config.order && { order: config.order as 'score' }),
      ...(config.noMatchSize != null && { no_match_size: config.noMatchSize }),
      ...(config.highlightQuery && { highlight_query: config.highlightQuery }),
      ...(config.matchedFields && { matched_fields: config.matchedFields }),
      ...(config.type && { type: config.type }),
    };
  }

  /**
   * Adds a field to highlight with optional configuration.
   *
   * @param fieldName - Field to highlight
   * @param options - Per-field highlight options (camelCase)
   */
  field<K extends keyof T>(
    fieldName: K,
    options?: HighlightFieldConfig,
  ): HighlightBuilder<T> {
    this.highlight.fields[fieldName as string] = options
      ? HighlightBuilder.toHighlightFieldOption(options)
      : {};
    return this;
  }

  /**
   * Adds multiple highlight fields at once.
   *
   * @param entries - Array of field entries with their highlight options
   */
  fields(entries: HighlightFieldEntry<T>[]): HighlightBuilder<T> {
    entries.forEach(({ name, ...options }) => {
      this.field(name, Object.keys(options).length ? options : undefined);
    });
    return this;
  }

  /**
   * Sets the HTML tags used to wrap highlighted text.
   *
   * @param preTags - Opening tags (e.g. `['<mark>']`)
   * @param postTags - Closing tags (e.g. `['</mark>']`)
   */
  tags(preTags: string[], postTags: string[]): HighlightBuilder<T> {
    this.highlight.pre_tags = preTags;
    this.highlight.post_tags = postTags;
    return this;
  }

  /**
   * Sets a custom query to use for highlighting instead of the search query.
   *
   * @param query - Custom highlight query
   */
  highlightQuery(query: Query): HighlightBuilder<T> {
    this.highlight.highlight_query = query;
    return this;
  }

  /** Builds and returns the {@link Highlight} configuration object. */
  build(): Highlight {
    return this.highlight;
  }
}

/**
 * Factory function to create a new {@link OpensearchQueryBuilder} instance.
 *
 * @typeParam T - The index document type
 *
 * @example
 * ```ts
 * const query = createQuery<Product>()
 *   .match('title', 'opensearch')
 *   .size(10)
 *   .build();
 * ```
 */
export const createQuery = <T extends IndexDocument>() =>
  new OpensearchQueryBuilder<T>();
