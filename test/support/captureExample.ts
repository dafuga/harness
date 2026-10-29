import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function captureExample(entry: { unit: string; id: string; state: string }, actual: unknown, expected: unknown) {
 const directory = process.env.HARNESS_EVIDENCE_DIR;
 if (!directory || process.env.TAKE_SCREENSHOT !== '1') return;
 mkdirSync(directory, { recursive: true });
 const file = entry.unit + '-' + entry.id + '.json';
 writeFileSync(join(directory, file), JSON.stringify({ actual, expected }));
 appendFileSync(join(directory, 'captures.ndjson'), JSON.stringify({ evidence: 'example-results', kind: 'assertions', state: entry.state, file, mediaType: 'application/json' }) + '\n');
}
