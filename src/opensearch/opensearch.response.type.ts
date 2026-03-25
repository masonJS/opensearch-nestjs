import { SearchAfter } from './opensearch.type.js';

export class CreateIndexResponse {
  readonly id: string;

  private constructor(id: string) {
    this.id = id;
  }

  static from(body: Record<string, any>): CreateIndexResponse {
    return new CreateIndexResponse(body._id);
  }
}

export class SearchHitResponse<T> {
  readonly source: T;
  readonly id: string;
  readonly score: number;
  readonly sort: SearchAfter;
  readonly index: string;
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

  getHighlight(field: string): string[] | undefined {
    return this.highlight?.[field];
  }

  getHighlightFirst(field: string): string | undefined {
    return this.highlight?.[field]?.[0];
  }

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

export class SearchResponse<T> {
  readonly total: number;
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

  get isEmpty(): boolean {
    return this.hits.length === 0;
  }

  get cursor(): string | undefined {
    const lastDoc = this.hits.at(-1);
    if (!lastDoc) {
      return undefined;
    }
    return JSON.stringify(lastDoc.sort);
  }
}
