// node examples/formatted-greetings.js — no credentials or network required.
import { bold, formatTemplate, fmt, link } from '../src/index.js';

const translations = {
  en: '👋 Hello, {name}! {docs}',
  ru: '👋 Привет, {name}! {docs}',
};
for (const [language, template] of Object.entries(translations)) {
  const greeting = formatTemplate(template, {
    name: bold('Ada 🚀'),
    docs: link('Anygram', 'https://github.com/link-foundation/anygram'),
  });
  console.log(language, JSON.stringify(fmt`${greeting}`));
  // await bot.api.sendMessage(chatId, greeting);
  // await account.sendMessage(peer, greeting);
}
