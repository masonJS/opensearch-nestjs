import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpenSearchQuery } from '../type/opensearch.type.js';

@Injectable()
export class OpensearchDocumentService {
  constructor(private readonly client: Client) {}

  async create<T extends object>(
    index: string,
    body: T,
  ): Promise<void> {
    await this.client.index({
      index,
      body,
      refresh: true,
    });
  }

  async update<T extends object>(
    index: string,
    id: string,
    doc: Partial<T>,
  ): Promise<void> {
    await this.client.update({
      index,
      id,
      body: { doc },
      refresh: true,
    });
  }

  async upsert<T extends object>(
    index: string,
    id: string,
    doc: Partial<T>,
  ): Promise<void> {
    await this.client.update({
      index,
      id,
      body: {
        doc,
        doc_as_upsert: true,
      },
      refresh: true,
    });
  }

  async getOne<T>(index: string, id: string): Promise<T | null> {
    try {
      const response = await this.client.get({ index, id });
      return response.body._source as T;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(index: string, id: string): Promise<void> {
    try {
      await this.client.delete({ index, id, refresh: true });
    } catch (error: any) {
      if (error?.body?.error?.type === 'index_not_found_exception') {
        throw error;
      }
      if (error?.statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  async bulkCreate<T extends object>(
    index: string,
    documents: T[],
  ): Promise<{ errors: boolean; items: any[] }> {
    if (documents.length === 0) {
      return { errors: false, items: [] };
    }

    const body = documents.flatMap((doc) => [
      { index: { _index: index } },
      doc,
    ]);

    const response = await this.client.bulk({ body, refresh: true });
    return response.body;
  }

  async bulkUpdate<T extends object>(
    index: string,
    updates: { id: string; doc: Partial<T> }[],
  ): Promise<{ errors: boolean; items: any[] }> {
    if (updates.length === 0) {
      return { errors: false, items: [] };
    }

    const body = updates.flatMap((update) => [
      { update: { _index: index, _id: update.id } },
      { doc: update.doc },
    ]);

    const response = await this.client.bulk({ body, refresh: true });
    return response.body;
  }

  async bulkUpsert<T extends object>(
    index: string,
    upserts: { id: string; doc: Partial<T> }[],
  ): Promise<{ errors: boolean; items: any[] }> {
    if (upserts.length === 0) {
      return { errors: false, items: [] };
    }

    const body = upserts.flatMap((upsert) => [
      { update: { _index: index, _id: upsert.id } },
      { doc: upsert.doc, doc_as_upsert: true },
    ]);

    const response = await this.client.bulk({ body, refresh: true });
    return response.body;
  }

  async deleteByQuery(index: string, query: OpenSearchQuery): Promise<number> {
    const response = await this.client.deleteByQuery({
      index,
      body: { query: query.query as any },
      refresh: true,
    });
    return (response.body as { deleted: number }).deleted;
  }

  async bulkDelete(
    index: string,
    ids: string[],
  ): Promise<{ errors: boolean; items: any[] }> {
    if (ids.length === 0) {
      return { errors: false, items: [] };
    }

    const body = ids.map((id) => ({ delete: { _index: index, _id: id } }));
    const response = await this.client.bulk({ body, refresh: true });
    return response.body;
  }
}
