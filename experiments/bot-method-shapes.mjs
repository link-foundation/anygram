import { factType } from './bot-fact-types.mjs';

// Request fields with identical model contracts retain that model as their source.
function modelFields(model, names) {
  return new Map(
    model.fields.map((field) => {
      let type = field.values
        ? field.values.map((value) => JSON.stringify(value)).join(' | ')
        : factType(field.type, names, {
            richText: "import('./index.js').RichTextArray",
          });
      if (field.upload) {
        type += ' | BotModels["InputFile"]';
      }
      return [
        field.name,
        `${field.name}${field.optional ? '?' : ''}: ${type};`,
      ];
    })
  );
}
export function referenceModelFields(nodes, models, names) {
  const candidates = models.map((model) => ({
    name: model.name,
    fields: modelFields(model, names),
  }));
  for (const node of nodes.values()) {
    node.modelReferences = [];
    for (;;) {
      const matches = candidates.map((model) => ({
        name: model.name,
        keys: [...node.fields]
          .filter(([key, value]) => model.fields.get(key) === value)
          .map(([key]) => key),
      }));
      const best = matches.sort((a, b) => b.keys.length - a.keys.length)[0];
      if (best.keys.length < 3) {
        break;
      }
      const keys = best.keys.map((key) => JSON.stringify(key)).join(' | ');
      node.modelReferences.push(`Pick<BotModels['${best.name}'], ${keys}>`);
      for (const key of best.keys) {
        node.fields.delete(key);
      }
    }
  }
}
