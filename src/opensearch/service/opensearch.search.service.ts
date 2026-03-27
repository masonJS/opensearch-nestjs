import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpenSearchQuery } from '../type/opensearch.type.js';
import { SearchResponse } from '../type/opensearch.response.type.js';

/**
 * Service for executing search and count queries against OpenSearch.
 */
@Injectable()
export class OpensearchSearchService {
  constructor(private readonly client: Client) {}

  /**
   * Executes a search query and returns a typed {@link SearchResponse}.
   *
   * @typeParam T - The index document type
   * @param index - Index name or array of index names to search
   * @param query - The search query built via `OpensearchQueryBuilder`
   * @returns Typed search response containing hits and total count
   */
  async search<T>(
    index: string | string[],
    query: OpenSearchQuery,
  ): Promise<SearchResponse<T>> {
    return await this.client
      .search({ index, body: query as any })
      .then((res) => SearchResponse.from<T>(res.body));
  }

  /**
   * Returns the number of documents matching the given query.
   *
   * @param index - Index name to count against
   * @param query - Optional query to filter counted documents
   * @returns The document count
   */
  async count(index: string, query?: OpenSearchQuery): Promise<number> {
    const response = await this.client.count({
      index,
      body: query ? { query: query.query as any } : undefined,
    });
    return response.body.count;
  }

}
