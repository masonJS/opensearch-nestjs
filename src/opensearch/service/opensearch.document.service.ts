import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpenSearchQuery } from '../type/opensearch.type.js';

/**
 * Service for CRUD and bulk operations on individual OpenSearch documents.
 * All write operations use `refresh: true` to make changes immediately visible.
 */
@Injectable()
export class OpensearchDocumentService {
  constructor(private readonly client: Client) {}

  /**
   * Indexes a new document. OpenSearch auto-generates the document `_id`.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param body - Document to index
   */
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

  /**
   * Partially updates an existing document by `_id`.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param id - Document `_id`
   * @param doc - Partial fields to update
   */
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

  /**
   * Updates the document if it exists, or inserts it as a new document otherwise.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param id - Document `_id`
   * @param doc - Document fields to upsert
   */
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

  /**
   * Retrieves a single document by `_id`.
   * Returns `null` if the document is not found (404).
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param id - Document `_id`
   * @returns The document source, or `null` if not found
   */
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

  /**
   * Deletes a document by `_id`.
   * No-ops if the document is not found (404).
   * Throws if the index itself does not exist.
   *
   * @param index - Target index name
   * @param id - Document `_id` to delete
   */
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

  /**
   * Indexes multiple documents in a single bulk request.
   * Returns early with no errors if the array is empty.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param documents - Array of documents to index
   * @returns Bulk response with `errors` flag and per-item results
   */
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

  /**
   * Partially updates multiple documents in a single bulk request.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param updates - Array of `{ id, doc }` pairs to update
   * @returns Bulk response with `errors` flag and per-item results
   */
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

  /**
   * Upserts multiple documents in a single bulk request.
   * Each document is inserted if it doesn't exist, or updated if it does.
   *
   * @typeParam T - The document type
   * @param index - Target index name
   * @param upserts - Array of `{ id, doc }` pairs to upsert
   * @returns Bulk response with `errors` flag and per-item results
   */
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

  /**
   * Deletes all documents matching the given query.
   *
   * @param index - Target index name
   * @param query - Query to select documents for deletion
   * @returns The number of deleted documents
   */
  async deleteByQuery(index: string, query: OpenSearchQuery): Promise<number> {
    const response = await this.client.deleteByQuery({
      index,
      body: { query: query.query as any },
      refresh: true,
    });
    return (response.body as { deleted: number }).deleted;
  }

  /**
   * Deletes multiple documents by their `_id`s in a single bulk request.
   *
   * @param index - Target index name
   * @param ids - Array of document `_id`s to delete
   * @returns Bulk response with `errors` flag and per-item results
   */
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
