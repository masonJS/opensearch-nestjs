import { Client } from '@opensearch-project/opensearch';
import {
  createQuery,
  CreateIndexResponse,
  SearchResponse,
} from '../../../src/index.js';
import { TestDocInput } from './test-index.js';

export class TestFixture {
  constructor(
    private readonly client: Client,
    private readonly index: string,
  ) {}

  async createIndex(settings: Record<string, any>) {
    const exists = await this.client.indices.exists({ index: this.index });
    if (!exists.body) {
      await this.client.indices.create({ index: this.index, body: settings });
    }
  }

  async clearDocuments() {
    await this.client.deleteByQuery({
      index: this.index,
      body: { query: { match_all: {} } },
      refresh: true,
    });
  }

  async insertDocument(doc: TestDocInput): Promise<CreateIndexResponse> {
    const res = await this.client.index({
      index: this.index,
      body: doc,
      refresh: true,
    });
    return CreateIndexResponse.from(res.body);
  }

  async findQuery<T>(
    builder: ReturnType<typeof createQuery<T>>,
  ): Promise<SearchResponse<T>> {
    const res = await this.client.search({
      index: this.index,
      body: builder.build() as any,
    });
    return SearchResponse.from<T>(res.body);
  }
}
