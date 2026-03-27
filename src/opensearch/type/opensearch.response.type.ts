import { SearchAfter } from './opensearch.type.js';

/**
 * Response wrapper for index document creation.
 * Extracts the document `_id` from the raw OpenSearch response.
 */
export class CreateIndexResponse {
  readonly id: string;

  private constructor(id: string) {
    this.id = id;
  }

  static from(body: Record<string, any>): CreateIndexResponse {
    return new CreateIndexResponse(body._id);
  }
}

/**
 * Represents a single search hit from an OpenSearch search response.
 * Wraps the raw hit object and provides typed access to `_source`,
 * metadata fields, and highlight helpers.
 *
 * @typeParam T - The index document type
 */
export class SearchHitResponse<T> {
  /** The original document stored in the index. */
  readonly source: T;
  /** The document `_id` assigned by OpenSearch. */
  readonly id: string;
  /** Relevance score for this hit. */
  readonly score: number;
  /** Sort values for this hit, used with `search_after` pagination. */
  readonly sort: SearchAfter;
  /** The index name this hit belongs to. */
  readonly index: string;
  /** Highlight fragments keyed by field name. */
  readonly highlight: Record<string, string[]>;

  private constructor(hit: Record<string, any>) {
    this.source = hit._source as T;
    this.id = hit._id;
    this.score = hit._score;
    this.sort = hit.sort;
    this.index = hit._index;
    this.highlight = hit.highlight;
  }

  static from<T>(hit: Record<string, any>): SearchHitResponse<T> {
    return new SearchHitResponse<T>(hit);
  }

  /** Returns all highlight fragments for the given field, or `undefined` if none. */
  getHighlight(field: string): string[] | undefined {
    return this.highlight?.[field];
  }

  /** Returns the first highlight fragment for the given field, or `undefined` if none. */
  getHighlightFirst(field: string): string | undefined {
    return this.highlight?.[field]?.[0];
  }

  /**
   * Returns the sentence containing the `<mark>` tag from the first highlight
   * fragment. Falls back to the raw fragment if no sentence boundary is found.
   */
  getHighlightSentence(field: string): string | undefined {
    const value = this.highlight?.[field]?.[0];
    if (!value) {
      return undefined;
    }
    return this.extractSentence(value) ?? value;
  }

  private extractSentence(str: string): string | undefined {
    const sentences = str
      .split(/\.\s*/)
      .filter((sentence) => sentence.trim().length > 0);

    for (const sentence of sentences) {
      if (sentence.includes('<mark>')) {
        return sentence;
      }
    }
  }
}

/**
 * Wraps an OpenSearch search response, providing the total hit count
 * and a typed array of {@link SearchHitResponse} objects.
 *
 * @typeParam T - The index document type
 */
export class SearchResponse<T> {
  /** Total number of documents matching the query. */
  readonly total: number;
  /** Array of individual search hits. */
  readonly hits: SearchHitResponse<T>[];

  private constructor(total: number, hits: SearchHitResponse<T>[]) {
    this.total = total;
    this.hits = hits;
  }

  static from<T>(body: Record<string, any>): SearchResponse<T> {
    const hitsMeta = body.hits;
    const total = hitsMeta.total.value;
    const hits = hitsMeta.hits.map((hit: Record<string, any>) =>
      SearchHitResponse.from<T>(hit),
    );
    return new SearchResponse<T>(total, hits);
  }

  /** Whether the search returned no results. */
  get isEmpty(): boolean {
    return this.hits.length === 0;
  }

  /**
   * Returns a JSON-serialized cursor string from the last hit's sort values,
   * suitable for `search_after` pagination. Returns `undefined` if there are no hits.
   */
  get cursor(): string | undefined {
    const lastDoc = this.hits.at(-1);
    if (!lastDoc) {
      return undefined;
    }
    return JSON.stringify(lastDoc.sort);
  }
}
