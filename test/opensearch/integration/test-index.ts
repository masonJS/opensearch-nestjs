// Query type reflects OpenSearch mapping (text with keyword subfield)
export interface TestDoc {
  title: { exact: string };
  body: { exact: string };
  type: string;
  createdAt: Date;
  _id: string;
  _score: number;
}

// Plain document type for indexing
export interface TestDocInput {
  title: string;
  body: string;
  type: string;
  createdAt: Date;
}

export const TEST_INDEX_NAME = 'test-index';

export const TEST_INDEX_SETTINGS = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
  },
  mappings: {
    properties: {
      title: {
        type: 'text',
        fields: { exact: { type: 'keyword' } },
      },
      body: {
        type: 'text',
        fields: { exact: { type: 'keyword' } },
      },
      type: { type: 'keyword' },
      createdAt: { type: 'date' },
    },
  },
};

export function createTestDoc(
  title: string,
  body: string,
  type: string,
  createdAt = new Date(),
): TestDocInput {
  return { title, body, type, createdAt };
}
