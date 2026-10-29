// Factor repeated field sets while retaining an exact expansion of every model.
function intersection(left, right) {
  return new Map(
    [...left.fields].filter(([key, value]) => right.fields.get(key) === value)
  );
}
function largestOverlap(nodes) {
  let best = new Map();
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      if (Math.min(nodes[first].fields.size, nodes[second].fields.size) < 2) {
        continue;
      }
      const common = intersection(nodes[first], nodes[second]);
      if (common.size > best.size) {
        best = common;
      }
    }
  }
  return best;
}
function expand(node, nodes, active = new Set()) {
  if (active.has(node.name)) {
    throw new Error(`Cyclic shared model fields: ${node.name}`);
  }
  const visited = new Set([...active, node.name]);
  const fields = new Map(node.fields);
  for (const reference of node.references) {
    for (const [key, value] of expand(nodes.get(reference), nodes, visited)) {
      if (fields.has(key)) {
        throw new Error(`Repeated model field: ${node.name}.${key}`);
      }
      fields.set(key, value);
    }
  }
  return fields;
}
const sorted = (map) =>
  JSON.stringify([...map].sort(([a], [b]) => a.localeCompare(b)));

export function factorModelFields(models, property) {
  const originals = new Map(
    models
      .filter((model) => model.fields.length)
      .map((model) => [
        model.name,
        new Map(model.fields.map((field) => [field.name, property(field)])),
      ])
  );
  const nodes = [...originals].map(([name, fields]) => ({
    name,
    fields: new Map(fields),
    references: [],
  }));
  const shared = [];
  for (;;) {
    const fields = largestOverlap(nodes);
    if (fields.size < 2) {
      break;
    }
    const name = `Fields${shared.length}`;
    for (const node of nodes) {
      if ([...fields].every(([key, value]) => node.fields.get(key) === value)) {
        for (const key of fields.keys()) {
          node.fields.delete(key);
        }
        node.references.push(name);
      }
    }
    const group = { name, fields, references: [] };
    nodes.push(group);
    shared.push(group);
  }
  const indexed = new Map(nodes.map((node) => [node.name, node]));
  for (const [name, fields] of originals) {
    if (sorted(fields) !== sorted(expand(indexed.get(name), indexed))) {
      throw new Error(`Factored model fields changed: ${name}`);
    }
  }
  return { indexed, shared };
}
