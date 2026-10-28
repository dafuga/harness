import { expect, test } from 'vitest';
import { TitleService } from '../../src/services/TitleService';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
test('TitleService.run: numeric text', () => {
 const actual = new TitleService().run(' 123 ');
 expect(actual).toBe('123');

 const directory = process.env.HARNESS_EVIDENCE_DIR;
 if (directory && process.env.TAKE_SCREENSHOT === '1') {
  mkdirSync(directory, { recursive: true });
  const file = 'method-result.json';
  writeFileSync(join(directory, file), JSON.stringify({ actual, expected: '123' }));
  appendFileSync(join(directory, 'captures.ndjson'), JSON.stringify({
   evidence: 'method-result', kind: 'assertions', state: 'initialized', file, mediaType: 'application/json'
  }) + '\n');
 }
});
