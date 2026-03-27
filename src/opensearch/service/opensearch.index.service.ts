import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class OpensearchIndexService {
  constructor(private readonly client: Client) {}

  async create(index: string, body: Record<string, any>): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (!exists.body) {
      await this.client.indices.create({ index, body });
    }
  }

  async delete(index: string): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (exists.body) {
      await this.client.indices.delete({ index });
    }
  }

  async putMapping(
    index: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    await this.client.indices.putMapping({
      index,
      body: { properties },
    });
  }
}
