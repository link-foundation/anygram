import { parseEnv } from 'node:util';

// Synthetic, finite .env cases for preserving unrelated multiline assignments.
const samples = [
  'KEY="first\\"last"\nAFTER=yes\n',
  "KEY='first\\'last'\nAFTER=yes\n",
  'KEY=`first\\`last`\nAFTER=yes\n',
  'KEY="first\nTELEGRAM_USER_SESSION=inside\nlast"\nAFTER=yes\n',
  "KEY='first\nTELEGRAM_USER_SESSION=inside\nlast'\nAFTER=yes\n",
  'KEY=`first\nTELEGRAM_USER_SESSION=inside\nlast`\nAFTER=yes\n',
  'TELEGRAM_USER_SESSION=first\nTELEGRAM_USER_SESSION=last\n',
  '\ufeff export TELEGRAM_USER_SESSION = "value" # comment\r\n',
  'KEY="unterminated\nAFTER=yes\n',
];
for (const text of samples) {
  console.log(JSON.stringify({ text, parsed: parseEnv(text) }));
}
