"""Regressions for official Bot API method contracts."""
import importlib.util
import json
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "methods", Path(__file__).with_name("extract-bot-method-facts.py")
)
methods = importlib.util.module_from_spec(spec)
spec.loader.exec_module(methods)


class MethodTests(unittest.TestCase):
    def test_request_fields_and_return(self):
        source = '''<h4>sendMessage</h4><p>On success, the sent Message is returned.</p>
        <table><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
        <tr><td>chat_id</td><td>Integer or String</td><td>Yes</td><td>Target.</td></tr>
        <tr><td>text</td><td>String</td><td>Optional</td><td>One of “one”, “two”.</td></tr>
        </table><h4>Message</h4><p>Object.</p>'''
        result = methods.extract(source)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["returns"], "Message")
        self.assertFalse(result[0]["fields"][0]["optional"])
        self.assertTrue(result[0]["fields"][1]["optional"])
        self.assertEqual(result[0]["fields"][1]["values"], ["one", "two"])

    def test_conditional_message_return(self):
        self.assertEqual(methods.return_type("editMessageText", "On success, the edited Message is returned, otherwise True is returned."), "Message or True")

    def test_arrays(self):
        self.assertEqual(methods.return_type("getUpdates", "Returns an Array of Update objects."), "Array of Update")

    def test_nonreturn_model_reference(self):
        self.assertEqual(methods.return_type("setWebhook", "Incoming Update objects are sent. Returns True on success."), "True")

    def test_unknown_return_rejected(self):
        with self.assertRaises(ValueError):
            methods.return_type("newMethod", "Something is returned.")

    def test_unknown_required_rejected(self):
        with self.assertRaises(ValueError):
            methods.parameter(["value", "String", "Sometimes", "Description."])

    def test_upload(self):
        field = methods.parameter(["photo", "String", "Yes", "Use attach://name to upload."])
        self.assertTrue(field["upload"])

    def test_complete_archive(self):
        directory = Path(__file__).parent.parent / "docs/case-studies/issue-1/data/bot-api"
        expected = json.loads((directory / "method-facts.json").read_text())
        self.assertEqual(methods.extract((directory / "api-2026-10-29.html").read_text()), expected["methods"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
