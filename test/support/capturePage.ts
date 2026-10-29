
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../../tests/e2e/support/browserTest';
import type { CaptureContext } from './capturePage.types';
export async function capturePage({ page, matchScreenshot, info, state, viewport }: CaptureContext) {
   const origin = 'http://127.0.0.1:' + readFileSync('.cache/harness/titles-port', 'utf8');
   await page.goto(origin + '/?state=' + state);
   await expect(page.locator('h1')).toHaveText(state === 'filled' ? '123' : 'No titles');
   await page.evaluate(() => document.fonts.ready);
   const original = await page.screenshot({ fullPage: true });
   const mode = process.env.FIXTURE_MEDIA;
   const bytes = mode === 'corrupt' ? Buffer.from('not an image') : mode === 'wrongtype' ? Buffer.from('RIFF negative fixture') : mode === 'truncated' ? original.subarray(0, Math.floor(original.length / 2)) : mode === 'wrongsize' ? await page.screenshot({ clip: { x: 0, y: 0, width: 100, height: 100 } }) : original;
   const stamp = await (await page.request.get(origin + '/build.json')).json();
   const directory = process.env.HARNESS_EVIDENCE_DIR;
   const file = state + '-' + viewport.id + '.png';
   if (directory && process.env.TAKE_SCREENSHOT === '1' && !(process.env.FIXTURE_SKIP ?? '').split(',').includes(state + '-' + viewport.id)) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, file), bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const server = { ...stamp, revision: process.env.FIXTURE_STALE_REVISION ?? stamp.revision };
    const entry = { evidence: 'screens', kind: 'screenshot', state, viewport: viewport.id, file, mediaType: 'image/png', provenance: 'actual-capture',
     ...(process.env.FIXTURE_NO_STAMP ? {} : { server }),
     note: JSON.stringify({ unit: 'page.titles', case: state + '.' + viewport.id, revision: stamp.revision, sha256, retry: info.retry }) };
    appendFileSync(join(directory, 'captures.ndjson'), JSON.stringify(entry) + '\n');
   }
   await matchScreenshot(page, file, { fullPage: true });
   expect(process.env.FIXTURE_FAIL ?? '').toBe('');
}
