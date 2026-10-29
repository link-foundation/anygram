"""Record public names and field-presence facts, without SDK implementation text."""
import hashlib
import json
import re
from pathlib import Path

sources = {}
namespaces = {}
for model, filename, base, fields in [
    ('MessageEntity', 'message.d.ts', 'AbstractMessageEntity', ['offset', 'length']),
    ('InlineKeyboardButton', 'markup.d.ts', 'AbstractInlineKeyboardButton',
     ['text', 'icon_custom_emoji_id', 'style']),
    ('KeyboardButton', 'markup.d.ts', 'CommonButton',
     ['text', 'icon_custom_emoji_id', 'style']),
    ('RichMessageButton', 'rich.d.ts', 'AbstractRichMessageButton', ['text', 'style']),
]:
    path = Path('node_modules/@grammyjs/types') / filename
    source = path.read_text()
    sources[str(path)] = hashlib.sha256(source.encode()).hexdigest()
    block = source.split(f'export declare namespace {model} {{', 1)[1].split('\n}', 1)[0]
    aliases = {}
    for match in re.finditer(r'^    interface (\w+)[^{]*\{(.*?)^    }', block, re.M | re.S):
        name, body = match.groups()
        body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
        required, optional = [], []
        for field, marker in re.findall(r'^        (\w+)(\??):', body, re.M):
            if field not in fields and field != 'type':
                (optional if marker else required).append(field)
        entry = {'required': required, 'optional': optional}
        if model == 'MessageEntity':
            literal = re.search(r'^        type: (.*);$', body, re.M).group(1)
            entry['types'] = None if literal == 'string' else re.findall(r'"([^"]+)"', literal)
        aliases[name] = entry
    namespaces[model] = {'base': base, 'fields': fields, 'aliases': aliases}

sdk = json.loads(Path('node_modules/@grammyjs/types/package.json').read_text())
facts = {'sdk': '@grammyjs/types@' + sdk['version'], 'sources': sources,
         'namespaces': namespaces}
target = Path('docs/case-studies/issue-1/data/bot-api/component-facts.json')
target.write_text(json.dumps(facts, indent=2) + '\n')
