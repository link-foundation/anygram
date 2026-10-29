import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as OriginalContext } from 'grammy';
import { Context } from '../src/index.js';
import { filterQuerySpellings } from '../experiments/filter-query-spellings.mjs';
import { filterFacts, me } from './fixtures/context-filters.js';

const grammar = filterQuerySpellings(filterFacts);

function witness([event, field, flag]) {
  if (field === undefined) {
    return { [event]: {} };
  }
  return {
    [event]: {
      [field]:
        flag === undefined ? {} : { type: flag, [flag]: true, id: me.id },
    },
  };
}

it('enumerates every reviewed concrete and shortcut query spelling', () => {
  assert.equal(grammar.concrete.length, 1140);
  assert.equal(grammar.queries.length, 1908);
  assert.equal(new Set(grammar.concrete).size, grammar.concrete.length);
  assert.equal(grammar.witnesses.size, grammar.queries.length);
});

it('accepts all 1908 type-level spellings and matches actual grammY witnesses', () => {
  for (const query of grammar.queries) {
    const reference = OriginalContext.has.filterQuery(query);
    const owned = Context.has.filterQuery(query);
    for (const update of [{}, witness(grammar.witnesses.get(query))]) {
      const expected = reference(new OriginalContext(update, {}, me));
      assert.equal(owned(new Context(update, {}, me)), expected, query);
      assert.equal(expected, Object.keys(update).length > 0, query);
    }
  }
});
