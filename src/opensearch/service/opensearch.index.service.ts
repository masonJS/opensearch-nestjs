import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

/**
 * Service for managing OpenSearch index lifecycle operations
 * such as creating, deleting, and updating index mappings.
 */
@Injectable()
export class OpensearchIndexService {
  constructor(private readonly client: Client) {}

  /**
   * Creates an index with the given settings/mappings body.
   * No-ops if the index already exists.
   *
   * @param index - Index name
   * @param body - Index settings and mappings
   */
  async create(index: string, body: Record<string, any>): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (!exists.body) {
      await this.client.indices.create({ index, body });
    }
  }

  /**
   * Deletes the specified index.
   * No-ops if the index does not exist.
   *
   * @param index - Index name to delete
   */
  async delete(index: string): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (exists.body) {
      await this.client.indices.delete({ index });
    }
  }

  /**
   * Updates the field mappings for an existing index.
   *
   * @param index - Index name
   * @param properties - Mapping properties to add or update
   */
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
