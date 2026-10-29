function entries(facts, index) {
  return facts.nodes[index]
    .split(' ')
    .filter(Boolean)
    .map((entry) => {
      const [key, child] = entry.split('@');
      return [key, Number(child)];
    });
}

export function filterQuerySpellings(facts) {
  const concrete = [];
  function visit(index, prefix) {
    for (const [key, child] of entries(facts, index)) {
      const path = [...prefix, key];
      concrete.push(path);
      if (path.length < 3) {
        visit(child, path);
      }
    }
  }
  visit(facts.root, []);
  const queries = new Map();
  for (const path of concrete) {
    let spellings = [[]];
    for (let level = 0; level < path.length; level += 1) {
      const aliases = Object.entries(facts.shortcuts[level] ?? {})
        .filter(
          ([alias, targets]) =>
            targets.includes(path[level]) && (alias || path.length > level + 1)
        )
        .map(([alias]) => alias);
      spellings = spellings.flatMap((prefix) =>
        [path[level], ...aliases].map((value) => [...prefix, value])
      );
    }
    for (const spelling of spellings) {
      queries.set(spelling.join(':'), path);
    }
  }
  return {
    concrete: concrete.map((path) => path.join(':')),
    queries: [...queries.keys()].sort(),
    witnesses: queries,
  };
}
