import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasCredentials } from './lib/kirapara-client.mjs';
import { discoveryProvider } from './providers/discovery.mjs';

const providers = new Map([
  [discoveryProvider.id, discoveryProvider],
]);

const feedId = process.argv[2] || 'discovery';
const provider = providers.get(feedId);

if (!provider) {
  throw new Error(`Unknown feed provider: ${feedId}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '..', 'docs', 'data', `${feedId}.json`);

if (!hasCredentials()) {
  console.warn('Kirapara credentials are not configured. Keeping the existing feed data.');
  process.exit(0);
}

let result;
try {
  result = await provider.fetchPage();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Feed refresh failed; keeping the existing published data. ${message}`);
  process.exit(0);
}

const payload = {
  meta: {
    feed: provider.id,
    label: provider.label,
    updatedAt: new Date().toISOString(),
    count: result.posts.length,
    nextCursor: result.nextCursor,
  },
  posts: result.posts,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

// Read-back catches accidental path/encoding mistakes in CI before publish.
JSON.parse(await readFile(outputPath, 'utf8'));
console.log(`Wrote ${result.posts.length} ${provider.label} posts to ${outputPath}`);
