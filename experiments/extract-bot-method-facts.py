"""Extract public Bot API method facts from the archived official document."""
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "models", Path(__file__).with_name("extract-bot-model-facts.py")
)
models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(models)


def sections(source):
    parser = models.Models(r"[a-z][A-Za-z0-9]*")
    parser.feed(source)
    return parser.sections


def parameter(row):
    name, kind, required, description = row
    if required not in ("Yes", "Optional"):
        raise ValueError(f"Unknown required marker: {required}")
    result = models.fact([name, kind, description])
    result["optional"] = required == "Optional"
    return result


def return_type(name, intro):
    known = {model["name"] for model in json.loads(
        (Path(__file__).parent.parent / "docs/case-studies/issue-1/data/bot-api/model-facts.json").read_text()
    )["models"]} | {"True", "Integer", "String"}
    clauses = [sentence for sentence in intro.split(".")
               if re.search(r"\b(?:returns?|returned)\b", sentence, re.I)]
    found = []
    for clause in clauses:
        for match in re.finditer(r"\b(?:Array of )?([A-Z][A-Za-z0-9]*)\b", clause):
            if match[1] in known:
                found.append(match[0])
    found = list(dict.fromkeys(found))
    if not found:
        raise ValueError(f"Unreviewed return contract: {name}: {intro}")
    return " or ".join(found)


def extract(source):
    output = []
    for section in sections(source):
        tables = [t for t in section["tables"] if t and t[0] == ["Parameter", "Type", "Required", "Description"]]
        if len(tables) > 1:
            raise ValueError(f"Multiple method tables: {section['name']}")
        intro = re.sub(r"\s+", " ", " ".join(section["intro"])).strip()
        output.append({
            "name": section["name"],
            "fields": [parameter(row) for row in tables[0][1:]] if tables else [],
            "returns": return_type(section["name"], intro),
        })
    return output


if __name__ == "__main__":
    data = Path(sys.argv[1]).read_bytes()
    if "--inspect" in sys.argv:
        for section in sections(data.decode()):
            print(section["name"], re.sub(r"\s+", " ", " ".join(section["intro"])).strip())
    else:
        result = {
            "source": "https://core.telegram.org/bots/api",
            "retrieved": "2026-10-29",
            "sha256": hashlib.sha256(data).hexdigest(),
            "methods": extract(data.decode()),
        }
        Path(sys.argv[2]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
        print(f"Extracted {len(result['methods'])} methods, {sum(len(m['fields']) for m in result['methods'])} arguments")
