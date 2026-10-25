import { expect, test } from 'vitest';
import { browserTestFiles } from '../src/templates/development-tooling/browserTest';

const fixtureSource = () =>
	browserTestFiles().find((file) => file.path.endsWith('browserTest.ts'))?.contents ?? '';

test('browser snapshots use an explicit settled target matcher', () => {
	const source = fixtureSource();
	expect(source).toContain('matchScreenshot: MatchScreenshot');
	expect(source).toContain('await expect(target).toHaveScreenshot(name, options);');
	expect(source).toContain('await globalThis.document.fonts.ready');
	expect(source).toContain('await image.decode();');
	expect(source).toContain(
		'globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame'
	);
	expect(source.indexOf('await settleScreenshot(target);')).toBeLessThan(
		source.indexOf('await expect(target).toHaveScreenshot(name, options);')
	);
});

test('browser snapshots keep baseline materialization and evidence separate', () => {
	const source = fixtureSource();
	expect(source).toContain('snapshot updates disabled');
	expect(source).toContain("process.env.TAKE_SCREENSHOT === '1'");
	expect(source).not.toContain('afterEach');
	expect(source).not.toContain('page.screenshot');
});
