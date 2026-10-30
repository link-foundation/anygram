import {
  filterRoot,
  filterNodes,
  filterShortcuts,
} from './bot-filter-facts.js';

const nodes = filterNodes.map(
  (text) =>
    new Map(
      text
        .split(' ')
        .filter(Boolean)
        .map((entry) => {
          const [key, child] = entry.split('@');
          return [key, Number(child)];
        })
    )
);
const shortcuts = filterShortcuts.map(
  (entries) => new Map(Object.entries(entries))
);
const cache = new Map();
const nonnull = (value) => value !== undefined && value !== null;
const child = (node, key) => nodes[node]?.get(key);

function invalidPath(parts) {
  let index = filterRoot;
  for (let level = 0; level < 3; level++) {
    const key = parts[level];
    if (key === undefined) {
      return undefined;
    }
    const next = child(index, key);
    if (next === undefined) {
      const permitted = [...nodes[index].keys()];
      const detail =
        level === 2 && permitted.length === 0
          ? `No further filtering is possible after '${parts.slice(0, 2).join(':')}'.`
          : `Permitted values are: ${permitted.map((value) => `'${value}'`).join(', ')}.`;
      return `Invalid L${level + 1} filter '${key}' given in '${parts.join(':')}'. ${detail}`;
    }
    index = next;
  }
  if (parts.length > 3) {
    return `Cannot filter further than three levels, ':${parts.slice(3).join(':')}' is invalid!`;
  }
}

function validExpansion(parts, level) {
  if (level === 0) {
    const [, second, third] = parts;
    return (
      second === undefined ||
      (shortcuts[1].has(second) && Boolean(second || third)) ||
      child(child(filterRoot, parts[0]), second) !== undefined
    );
  }
  return (
    parts[2] === undefined ||
    child(child(child(filterRoot, parts[0]), parts[1]), parts[2]) !== undefined
  );
}

function expand(parts) {
  let paths = [parts];
  for (let level = 0; level < 2; level++) {
    paths = paths.flatMap((path) => {
      const values = shortcuts[level].get(path[level]);
      if (!values || !path.slice(level, 3).some(Boolean)) {
        return [path];
      }
      return values
        .map((value) => {
          const copy = [path[0], path[1], path[2]];
          copy[level] = value;
          return copy;
        })
        .filter((copy) => validExpansion(copy, level));
    });
  }
  if (paths.length === 0) {
    throw new Error(
      `Shortcuts in '${parts.join(':')}' do not expand to any valid filter query`
    );
  }
  const errors = paths.map(invalidPath).filter(Boolean);
  if (errors.length === 1) {
    throw new Error(errors[0]);
  }
  if (errors.length > 1) {
    throw new Error(
      `Invalid filter query '${parts.join(':')}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join('; ')}`
    );
  }
  return paths;
}

function mergePaths(paths) {
  const tree = new Map();
  for (const [event, field, flag] of paths) {
    if (!tree.has(event)) {
      tree.set(event, new Map());
    }
    if (field === undefined) {
      continue;
    }
    const fields = tree.get(event);
    if (!fields.has(field)) {
      fields.set(field, new Set());
    }
    if (flag !== undefined) {
      fields.get(field).add(flag);
    }
  }
  return tree;
}

function matchesFlag(value, flags, ctx) {
  for (const flag of flags) {
    const id = flag === 'me' ? ctx.me.id : undefined;
    const test = (item) =>
      nonnull(item) &&
      (flag === 'me' ? item.id === id : item[flag] || item.type === flag);
    if (Array.isArray(value) ? value.some(test) : test(value)) {
      return true;
    }
  }
  return false;
}

function matchesFields(value, fields, ctx) {
  if (fields.size === 0) {
    return nonnull(value);
  }
  if (!value) {
    return false;
  }
  for (const [field, flags] of fields) {
    const item = value[field];
    if (
      flags.size === 0 ? nonnull(item) : item && matchesFlag(item, flags, ctx)
    ) {
      return true;
    }
  }
  return false;
}

/** Compile public grammY query facts without evaluating SDK implementation. */
export function matchFilter(filter) {
  const queries = Array.isArray(filter) ? [...filter] : [filter];
  if (
    queries.length > 1000 ||
    queries.some((query) => typeof query !== 'string' || query.length > 4096)
  ) {
    throw new RangeError('Filter query budget exceeded');
  }
  const key = JSON.stringify(queries);
  let predicate = cache.get(key);
  if (!predicate) {
    const tree = mergePaths(
      queries.flatMap((query) => expand(query.split(':')))
    );
    if (tree.size === 0) {
      throw new Error('Cannot create filter function for empty query');
    }
    predicate = (ctx) =>
      [...tree].some(([event, fields]) =>
        matchesFields(ctx.update[event], fields, ctx)
      );
    if (cache.size >= 128) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, predicate);
  }
  return (ctx) => predicate(ctx);
}
