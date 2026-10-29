"""Regressions for extracting wire facts rather than prose examples."""
import importlib.util
import json
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "facts", Path(__file__).with_name("extract-bot-model-facts.py")
)
facts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(facts)


class FactTests(unittest.TestCase):
    def test_complete_archived_facts(self):
        directory = Path(__file__).parent.parent / "docs/case-studies/issue-1/data/bot-api"
        document = (directory / "api-2026-10-29.html").read_text()
        expected = json.loads((directory / "model-facts.json").read_text())
        self.assertEqual(facts.extract(document), expected["models"])

    def test_quoted_discriminant(self):
        self.assertEqual(facts.fact(["type", "String", 'Type, always “photo”'])["values"], ["photo"])

    def test_enum_with_file_extensions(self):
        value = facts.fact([
            "format", "String",
            'Format must be one of “static” for .WEBP, “animated” for .TGS, “video” for .WEBM.',
        ])
        self.assertEqual(value["values"], ["static", "animated", "video"])

    def test_non_enum_prose(self):
        value = facts.fact(["payload", "String", 'Payload can be used as one of the keys in a “map”.'])
        self.assertNotIn("values", value)

    def test_numeric_constant(self):
        self.assertEqual(facts.fact(["date", "Integer", "Always 0."])["values"], [0])
        self.assertNotIn("values", facts.fact(["number", "Integer", "Always 0 for crafted gifts."]))

    def test_upload_and_optional(self):
        value = facts.fact(["media", "String", "Optional. File identifier or attach://name."])
        self.assertTrue(value["optional"])
        self.assertTrue(value["upload"])

    def test_emoji_and_plain_button(self):
        source = '''<h4>KeyboardButton</h4><p>For text buttons, <em>String</em>
        can be used instead of this object.</p><table><tr><th>Field</th><th>Type</th>
        <th>Description</th></tr><tr><td>emoji</td><td>String</td>
        <td>One of “<img alt="👍">”, “<img alt="👎">”.</td></tr></table>'''
        model = facts.extract(source)[0]
        self.assertEqual(model["alternatives"], ["String"])
        self.assertEqual(model["fields"][0]["values"], ["👍", "👎"])

    def test_recursive_union(self):
        source = '''<h4>RichText</h4><p>Can be either a String for plain text,
        an Array of RichText, or:</p><ul><li><a href="#richtextbold">Bold</a></li></ul>
        <h4>RichTextBold</h4><p>Bold text.</p><h3>Methods</h3><h4>sendMessage</h4>'''
        models = facts.extract(source)
        self.assertEqual([m["name"] for m in models], ["RichText", "RichTextBold"])
        self.assertEqual(models[0]["alternatives"], ["String", "Array of RichText"])
        self.assertEqual(models[0]["members"], ["RichTextBold"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
