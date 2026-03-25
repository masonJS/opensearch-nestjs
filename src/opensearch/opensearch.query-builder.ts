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
} from './opensearch.type.js';

export class OpenSearchQueryBuilder<T extends IndexDocument> {
  private query: OpenSearchQuery = {};

  size(size: number): OpenSearchQueryBuilder<T> {
    this.query.size = size;
    return this;
  }

  from(from: number): OpenSearchQueryBuilder<T> {
    this.query.from = from;
    return this;
  }

  bool(
    builder: (boolBuilder: BoolQueryBuilder<T>) => void,
  ): OpenSearchQueryBuilder<T> {
    const boolBuilder = new BoolQueryBuilder<T>();
    builder(boolBuilder);
    this.query.query = { bool: boolBuilder.build() };
    return this;
  }

  sort(
    builder: (sortBuilder: SortBuilder<T>) => void,
  ): OpenSearchQueryBuilder<T> {
    const sortBuilder = new SortBuilder<T>();
    builder(sortBuilder);
    this.query.sort = sortBuilder.build();
    return this;
  }

  sortBy<K extends keyof T>(
    field: K,
    order: 'asc' | 'desc' = 'desc',
  ): OpenSearchQueryBuilder<T> {
    this.query.sort = [{ [field as string]: { order } }];
    return this;
  }

  highlight(
    builder: (highlightBuilder: HighlightBuilder<T>) => void,
  ): OpenSearchQueryBuilder<T> {
    const highlightBuilder = new HighlightBuilder<T>();
    builder(highlightBuilder);
    this.query.highlight = highlightBuilder.build();
    return this;
  }

  term<K extends keyof T>(
    field: K,
    value: TermValue,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  term<P extends FlattenedKeys<T>>(
    field: P,
    value: TermValue,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  term(
    field: string,
    value: TermValue,
    boost?: number,
  ): OpenSearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.term = {
      [field]: { value, ...(boost != null && { boost }) },
    };
    return this;
  }

  wildcard<K extends keyof T>(
    field: K,
    value: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  wildcard<P extends FlattenedKeys<T>>(
    field: P,
    value: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  wildcard(
    field: string,
    value: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.wildcard = {
      [field]: { value, ...(boost != null && { boost }) },
    };
    return this;
  }

  match<K extends keyof T>(
    field: K,
    query: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  match<P extends FlattenedKeys<T>>(
    field: P,
    query: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T>;

  match(
    field: string,
    query: string,
    boost?: number,
  ): OpenSearchQueryBuilder<T> {
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

  range<K extends keyof T>(field: K, range: Range): OpenSearchQueryBuilder<T>;

  range<P extends FlattenedKeys<T>>(
    field: P,
    range: Range,
  ): OpenSearchQueryBuilder<T>;

  range(field: string, range: Range): OpenSearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.range = { [field]: range };
    return this;
  }

  exists<K extends keyof T>(field: K): OpenSearchQueryBuilder<T>;

  exists<P extends FlattenedKeys<T>>(field: P): OpenSearchQueryBuilder<T>;

  exists(field: string): OpenSearchQueryBuilder<T> {
    if (!this.query.query) {
      this.query.query = {};
    }
    this.query.query.exists = { field };
    return this;
  }

  lastId(lastId: SearchAfter): OpenSearchQueryBuilder<T> {
    this.query.search_after = lastId;
    return this;
  }

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

  multiMatch(
    query: string,
    fields: MultiMatchField<T>[],
    type: MultiMatchType = 'best_fields',
  ): OpenSearchQueryBuilder<T> {
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

  source(fields?: (keyof T)[] | boolean): OpenSearchQueryBuilder<T> {
    this.query._source = fields as string[] | boolean;
    return this;
  }

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

  build(): OpenSearchQuery {
    return this.query;
  }

  setQuery(query: any): OpenSearchQueryBuilder<T> {
    this.query.query = query;
    return this;
  }
}

export class BoolQueryBuilder<T extends IndexDocument> {
  private boolQuery: BoolQuery = {};

  must(
    builder: (mustBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const mustBuilder = new QueryCollectionBuilder<T>();
    builder(mustBuilder);
    this.boolQuery.must = mustBuilder.getQueries();
    return this;
  }

  should(
    builder: (shouldBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const shouldBuilder = new QueryCollectionBuilder<T>();
    builder(shouldBuilder);
    this.boolQuery.should = shouldBuilder.getQueries();
    return this;
  }

  mustNot(
    builder: (mustNotBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const mustNotBuilder = new QueryCollectionBuilder<T>();
    builder(mustNotBuilder);
    this.boolQuery.must_not = mustNotBuilder.getQueries();
    return this;
  }

  filter(
    builder: (filterBuilder: QueryCollectionBuilder<T>) => void,
  ): BoolQueryBuilder<T> {
    const filterBuilder = new QueryCollectionBuilder<T>();
    builder(filterBuilder);
    this.boolQuery.filter = filterBuilder.getQueries();
    return this;
  }

  minimumShouldMatch(minimum: number): BoolQueryBuilder<T> {
    this.boolQuery.minimum_should_match = minimum;
    return this;
  }

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

  build(): BoolQuery {
    return this.boolQuery;
  }
}

export class SortBuilder<T extends IndexDocument> {
  private sortFields: any[] = [];

  field<K extends keyof T>(
    fieldName: K,
    order: 'asc' | 'desc' = 'desc',
  ): SortBuilder<T> {
    this.sortFields.push({ [fieldName as string]: { order } });
    return this;
  }

  score(order: 'asc' | 'desc' = 'desc'): SortBuilder<T> {
    this.sortFields.push({ _score: { order } });
    return this;
  }

  build(): any[] {
    return this.sortFields;
  }
}

export class QueryCollectionBuilder<T extends IndexDocument> {
  private queries: Query[] = [];

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

  range<K extends keyof T>(field: K, range: Range): QueryCollectionBuilder<T>;

  range<P extends FlattenedKeys<T>>(
    field: P,
    range: Range,
  ): QueryCollectionBuilder<T>;

  range(field: string, range: Range): QueryCollectionBuilder<T> {
    this.queries.push({ range: { [field]: range } });
    return this;
  }

  exists<K extends keyof T>(field: K): QueryCollectionBuilder<T>;

  exists<P extends FlattenedKeys<T>>(field: P): QueryCollectionBuilder<T>;

  exists(field: string): QueryCollectionBuilder<T> {
    this.queries.push({ exists: { field } });
    return this;
  }

  bool(
    builder: (boolBuilder: BoolQueryBuilder<T>) => void,
  ): QueryCollectionBuilder<T> {
    const boolBuilder = new BoolQueryBuilder<T>();
    builder(boolBuilder);
    this.queries.push({ bool: boolBuilder.build() });
    return this;
  }

  query(customQuery: Query): QueryCollectionBuilder<T> {
    this.queries.push(customQuery);
    return this;
  }

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

  getQueries(): Query[] {
    return this.queries;
  }
}

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

  field<K extends keyof T>(
    fieldName: K,
    options?: HighlightFieldConfig,
  ): HighlightBuilder<T> {
    this.highlight.fields[fieldName as string] = options
      ? HighlightBuilder.toHighlightFieldOption(options)
      : {};
    return this;
  }

  fields(entries: HighlightFieldEntry<T>[]): HighlightBuilder<T> {
    entries.forEach(({ name, ...options }) => {
      this.field(name, Object.keys(options).length ? options : undefined);
    });
    return this;
  }

  tags(preTags: string[], postTags: string[]): HighlightBuilder<T> {
    this.highlight.pre_tags = preTags;
    this.highlight.post_tags = postTags;
    return this;
  }

  highlightQuery(query: Query): HighlightBuilder<T> {
    this.highlight.highlight_query = query;
    return this;
  }

  build(): Highlight {
    return this.highlight;
  }
}

export const createQuery = <T extends IndexDocument>() =>
  new OpenSearchQueryBuilder<T>();
