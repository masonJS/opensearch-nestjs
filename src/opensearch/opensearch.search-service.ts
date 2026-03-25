import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpenSearchQuery } from './opensearch.type.js';
import { SearchResponse } from './opensearch.response.type.js';

@Injectable()
export class OpensearchSearchService {
  constructor(private readonly client: Client) {}

  async search<T>(
    index: string | string[],
    query: OpenSearchQuery,
  ): Promise<SearchResponse<T>> {
    return await this.client
      .search({ index, body: query as any })
      .then((res) => SearchResponse.from<T>(res.body));
  }

  async count(index: string, query?: OpenSearchQuery): Promise<number> {
    const response = await this.client.count({
      index,
      body: query ? { query: query.query as any } : undefined,
    });
    return response.body.count;
  }

}
