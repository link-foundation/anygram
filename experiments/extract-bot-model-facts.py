"""Extract public field facts from an archived official Bot API page."""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class Models(HTMLParser):
    def __init__(self, pattern=r"[A-Z][A-Za-z0-9]*"):
        super().__init__()
        self.pattern = pattern
        self.sections = []
        self.section = None
        self.heading = None
        self.cell = None
        self.row = None
        self.table = None
        self.in_list = 0
        self.link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("h3", "h4"):
            self.section = None
        if tag == "h4":
            self.heading = []
        if self.section is None:
            return
        if tag == "table":
            self.table = []
        if tag == "tr" and self.table is not None:
            self.row = []
        if tag in ("td", "th") and self.row is not None:
            self.cell = []
        if tag == "ul":
            self.in_list += 1
        if tag == "a" and self.in_list:
            self.link = attrs.get("href", "")
        if tag == "img" and self.cell is not None:
            self.cell.append(attrs.get("alt", ""))
        if tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, data):
        if self.heading is not None:
            self.heading.append(data)
        if self.cell is not None:
            self.cell.append(data)
        elif self.section is not None and self.table is None and not self.in_list:
            self.section["intro"].append(data)

    def handle_endtag(self, tag):
        if tag == "h4" and self.heading is not None:
            name = "".join(self.heading).strip()
            if re.fullmatch(self.pattern, name):
                self.section = {"name": name, "tables": [], "members": [], "intro": []}
                self.sections.append(self.section)
            self.heading = None
        if self.section is None:
            return
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(re.sub(r"\s+", " ", "".join(self.cell)).strip())
            self.cell = None
        if tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        if tag == "table" and self.table is not None:
            self.section["tables"].append(self.table)
            self.table = None
        if tag == "ul":
            self.in_list -= 1
        if tag == "a" and self.link is not None:
            if self.link.startswith("#"):
                self.section["members"].append(self.link[1:])
            self.link = None


def fact(row):
    name, kind, description = row
    result = {"name": name, "type": kind, "optional": description.startswith("Optional")}
    # Record only explicit constant facts, never explanatory prose.
    match = re.search(r'(?:always|must be) [“"]([^”"]+)[”"]', description, re.I)
    if kind == "String" and match:
        result["values"] = [match[1]]
    elif kind == "String" and name in ("type", "status", "source"):
        match = re.search(r"(?:always|must be) ([a-z_]+)(?:[.,; ]|$)", description)
        if match and match[1] not in ("one", "either", "a", "the"):
            result["values"] = [match[1]]
    if kind == "String" and "values" not in result:
        choices = re.search(r'(?:one of|can be(?: either)?)\s+(?=[“"])', description, re.I)
        if choices:
            quoted = re.findall(r'“([^”]+)”|"([^"]+)"', description[choices.end():])
            values = list(dict.fromkeys(a or b for a, b in quoted))
            if values:
                result["values"] = values
    if kind == "String" and "attach://" in description:
        result["upload"] = True
    if kind == "Integer" and re.search(r"always 0(?:\.|$)", description, re.I):
        result["values"] = [0]
    return result


def extract(source):
    parser = Models()
    parser.feed(source)
    names = {s["name"].lower(): s["name"] for s in parser.sections}
    output = []
    for section in parser.sections:
        tables = [t for t in section["tables"] if t and t[0] == ["Field", "Type", "Description"]]
        if len(tables) > 1:
            raise ValueError(f"Multiple field tables: {section['name']}")
        fields = [fact(row) for row in tables[0][1:]] if tables else []
        alternatives = []
        intro = re.sub(r"\s+", " ", " ".join(section["intro"]))
        if "either a String for plain text, an Array of" in intro:
            alternatives = ["String", f"Array of {section['name']}"]
        elif "String can be used instead of this object" in intro:
            alternatives = ["String"]
        output.append({
            "name": section["name"],
            "fields": fields,
            "alternatives": alternatives,
            "members": list(dict.fromkeys(names[n] for n in section["members"] if n in names)),
        })
    return output


if __name__ == "__main__":
    data = Path(sys.argv[1]).read_bytes()
    result = {
        "source": "https://core.telegram.org/bots/api",
        "retrieved": "2026-10-29",
        "sha256": hashlib.sha256(data).hexdigest(),
        "models": extract(data.decode()),
    }
    Path(sys.argv[2]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(f"Extracted {len(result['models'])} models, {sum(len(m['fields']) for m in result['models'])} fields")
