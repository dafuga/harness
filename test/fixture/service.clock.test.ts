import { expect, test } from 'vitest';
import { ClockService } from '../../src/services/ClockService';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
test('ClockService.run: numeric text', () => {
 const actual = new ClockService().run('123');
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
