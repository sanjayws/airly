import worker from '../worker.js';
const response = await worker.fetch(new Request('https://airly.test/'), {}, {});
const html = await response.text();
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (!match[0].startsWith('<script type="application/ld+json"')) new Function(match[1]);
}
console.log('Embedded frontend syntax is valid.');
