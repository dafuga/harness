
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../../tests/e2e/support/browserTest';
import type { ComponentCaptureContext, FixtureComponentContract } from './captureComponent.types';
export async function captureComponent({ page, matchScreenshot, info, unit, state, viewport }: ComponentCaptureContext) {
 const manifest = JSON.parse(readFileSync('specification/units/' + unit + '.json', 'utf8')) as FixtureComponentContract;
 const id = state + '.' + viewport.id;
 const entry = manifest.testing.cases.find((item) => item.id === id)!;
 const before = JSON.stringify(entry.input);
 const origin = 'http://127.0.0.1:' + readFileSync('.cache/harness/components-port', 'utf8');
 await page.setViewportSize({ width: viewport.width, height: viewport.height });
 await page.goto(origin + '/?unit=' + encodeURIComponent(unit) + '&props=' + encodeURIComponent(before));
 if (state === 'child') await expect(page.getByText('Child content', { exact: true })).toBeVisible();
 else { await expect(page.locator('li')).toHaveText('123'); await expect(page.locator('li')).toHaveAttribute('data-slug', '123'); }
 await page.evaluate(() => document.fonts.ready);
 const layout = manifest.kind === 'layout';
 const selector = unit === 'component.title-list' ? 'ul' : unit === 'component.title-row' ? 'li' : 'section';
 const element = page.locator(selector).first();
 const clip = layout ? undefined : await element.boundingBox();
 if (!layout && !clip) throw new Error('Rendered component has no visible bounds');
 const bytes = layout ? await page.screenshot({ fullPage: true }) : await element.screenshot();
 const stamp = await (await page.request.get(origin + '/build.json')).json();
 const directory = process.env.HARNESS_EVIDENCE_DIR;
 const file = state + '-' + viewport.id + '.png';
 if (directory && process.env.TAKE_SCREENSHOT === '1') {
  mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, file), bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const capture = { evidence: unit === 'component.title-frame' ? 'frame-screens' : 'screens', kind: 'screenshot', state, viewport: viewport.id, file, mediaType: 'image/png', provenance: 'actual-capture', server: stamp, ...(clip ? { clip } : {}),
   note: JSON.stringify({ unit, case: id, revision: stamp.revision, sha256, retry: info.retry }) };
  appendFileSync(join(directory, 'captures.ndjson'), JSON.stringify(capture) + '\n');
 }
 if (layout) await matchScreenshot(page, file, { fullPage: true });
 else await matchScreenshot(element, file);
 expect(JSON.stringify(entry.input)).toBe(before);
}
