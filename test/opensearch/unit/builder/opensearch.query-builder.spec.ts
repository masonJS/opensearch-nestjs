import { describe, expect, it } from 'vitest';
import { createQuery } from '../../../../src/index.js';

describe('OpensearchQueryBuilder utility behavior', () => {
  it('includes boost when value is 0', () => {
    const query = createQuery<{ title: string }>()
      .match('title', 'hello', 0)
      .build();

    expect(query.query).toEqual({
      match: {
        title: {
          query: 'hello',
          boost: 0,
        },
      },
    });
  });

  it('supports non-string term values at top-level', () => {
    const query = createQuery<{ active: boolean; count: number }>()
      .term('active', false)
      .term('count', 0)
      .build();

    expect(query.query).toEqual({
      term: {
        count: {
          value: 0,
        },
      },
    });
  });

  it('supports non-string term values in bool collections', () => {
    const query = createQuery<{ active: boolean; count: number }>()
      .bool((bool) => {
        bool.filter((filter) => {
          filter.term('active', false).term('count', 10, 0);
        });
      })
      .build();

    expect(query.query).toEqual({
      bool: {
        filter: [
          { term: { active: { value: false } } },
          { term: { count: { value: 10, boost: 0 } } },
        ],
      },
    });
  });
});
