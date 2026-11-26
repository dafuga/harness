import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { macSpecPage, phoneSpecPage, specTracker } from './support/viewSpecInboxFixture';

/**
 * "View spec" in the Needs you inbox, as the Mac app and as the iPhone app, in headless Chromium.
 * The committed document is made up. A real private spec is proven with SPEC_PROOF_FILE and a
 * SCREENSHOT_DIR outside the repository: neither its text nor its pictures belong in it.
 */
test.setTimeout(90_000);

const sample = [
	'# Notes service',
	'| Part | Owner |',
	'| --- | --- |',
	'| API | Service |',
	'',
	'```mermaid',
	'sequenceDiagram',
	'  App->>API: save',
	'  API-->>App: saved',
	'```'
].join('\n');

async function readSpec(page: Page, shotName: string) {
	await page
		.getByRole('list', { name: 'Needs you' })
		.getByRole('button', { name: /Fixture.*waiting/s })
		.click();
	const open = page.getByRole('button', { name: /View spec/ });
	await expect(open).toContainText(`PR ${process.env.SPEC_PROOF_PR ?? 12}`);
	const shot = async (name: string) => {
		if (process.env.TAKE_SCREENSHOT !== 'true') return;
		const directory = process.env.SCREENSHOT_DIR ?? 'test-results/view-spec';
		await page.screenshot({ path: `${directory}/${shotName}-${name}.png` });
	};
	await shot('chat');
	await open.click();
	const modal = page.getByRole('dialog', { name: /service\.md/ });
	const reading = modal.getByRole('region', { name: 'Document' });
	await expect(reading.getByRole('table').first()).toBeVisible();
	await expect(reading.locator('.spec-diagram svg').first()).toBeVisible({ timeout: 30_000 });
	await expect(reading.locator('code.language-mermaid')).toHaveCount(0, { timeout: 30_000 });
	const answers = modal.getByRole('region', { name: 'Answer' });
	await expect(answers.getByRole('button', { name: /Approve.*Recommended/s })).toBeInViewport();
	await expect(answers.getByRole('button', { name: /^Other/ })).toBeAttached();
	expect(await reading.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
	await shot('modal');
	await reading.getByRole('table').first().scrollIntoViewIfNeeded();
	await shot('modal-table');
	await reading.locator('.spec-diagram').first().scrollIntoViewIfNeeded();
	await shot('modal-diagram');
	await answers.getByRole('button', { name: /Ask for changes/ }).click();
	await expect(modal).toBeHidden();
}

async function spec() {
	const proof = process.env.SPEC_PROOF_FILE;
	const markdown = proof ? await readFile(proof, 'utf8') : sample;
	return specTracker(markdown, process.env.SPEC_PROOF_TITLE ?? 'notes-service.md');
}

test('Mac: View spec reads the document and a tap in the modal answers', async ({ page }) => {
	const tracker = await spec();
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	const restore = await macSpecPage(page, tracker);
	try {
		await page.goto('/tracker');
		await readSpec(page, 'mac');
		// As in the chat, a tap is the answer; only deploy, money and secret asks add a step.
		await expect(page.getByText('Answer saved to Tracker.')).toBeVisible();
		expect(tracker.items.get('fixturespec').answer).toBe('Ask for changes');
	} finally {
		restore();
		tracker.close();
	}
});

test('iPhone: View spec reads the replicated document through its own call', async ({ page }) => {
	const tracker = await spec();
	const calls: string[] = [];
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	try {
		await phoneSpecPage(page, tracker, calls);
		await page.goto('/tracker');
		await readSpec(page, 'iphone');
		await expect.poll(() => calls).toContain('tracker_answer');
		expect(calls).toContain('tracker_document');
	} finally {
		tracker.close();
	}
});
