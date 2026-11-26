import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';

/**
 * "View spec" in the asking session's chat. The committed document is made up. To prove a real
 * private spec, name a local copy in SPEC_PROOF_FILE and keep SCREENSHOT_DIR outside the
 * repository: neither the text nor its pictures belong in it.
 */
test.setTimeout(90000);

const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const sample = [
	'# Notes service',
	'## Parts',
	'| Part | What it does | Owner | Notes |',
	'| --- | --- | --- | --- |',
	'| API | Stores notes | Service | REST over HTTPS |',
	'## Flow',
	'```mermaid',
	'flowchart LR',
	'  App --> API --> Store',
	'```',
	'![sketch](sketch.png) ![remote](https://tracking.example/pixel.png)',
	'<script>window.specRan = true</script><img src="x" onerror="window.specRan = true">',
	'[bad](javascript:window.specRan=true) [good](https://example.com/)',
	'<form action="https://tracking.example"><input name="a"></form>'
].join('\n');
const pixel =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhWMjWwAAAABJRU5ErkJggg==';
const attachment = {
	id: 'a'.repeat(64),
	kind: 'spec' as const,
	title: process.env.SPEC_PROOF_TITLE ?? 'notes-service.md',
	repo: 'acme/notes',
	pr: Number(process.env.SPEC_PROOF_PR ?? 12),
	path: 'specifications/notes-service.md',
	ref: process.env.SPEC_PROOF_REF ?? 'abcdef123456',
	bytes: 1
};

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/view-spec';
	await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
}

async function chatWithSpec(page: Page, size: keyof typeof sizes) {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	const fixture = await hubHomeFixture(page, 'default');
	const [chief] = fixture.snapshot.agents;
	const ask = {
		question: 'Approve the service spec and start the build?',
		options: [
			{
				label: 'Approve and start the build',
				effect: 'Merges the spec.',
				recommended: true as const
			},
			{ label: 'Approve a smaller first part', effect: 'The rest becomes later tasks.' },
			{ label: 'Ask for changes', effect: 'The session revises it and asks again.' }
		]
	};
	const notes = {
		...chief,
		...ask,
		id: 'notes',
		name: 'notes',
		itemId: 'item-notes',
		confirm: undefined,
		messages: []
	};
	fixture.snapshot.agents.push(notes);
	fixture.snapshot.openAsks = [
		{
			...ask,
			itemId: 'item-notes',
			agentId: 'notes',
			agentName: 'notes',
			title: 'Notes service spec',
			attachments: [attachment],
			since: notes.since
		}
	];
	const proof = process.env.SPEC_PROOF_FILE;
	const markdown = proof ? await readFile(proof, 'utf8') : sample;
	const outside: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('tracking.example')) outside.push(request.url());
	});
	await page.route('**/api/hub-home/doc?**', (route) =>
		route.fulfill({ json: { markdown, images: { 'sketch.png': pixel } } })
	);
	await page.goto('/');
	await page
		.getByRole('region', { name: /^Blocked - needs you/ })
		.getByRole('button')
		.filter({ hasText: 'service spec' })
		.click();
	return { fixture, outside, proof };
}

for (const size of ['desktop', 'phone'] as const) {
	test(`View spec reads the document beside the answer choices (${size})`, async ({ page }) => {
		const { fixture, outside, proof } = await chatWithSpec(page, size);
		const open = page.getByRole('button', { name: /View spec/ });
		await expect(open).toContainText(`PR ${attachment.pr}`);
		await shot(page, `hub-chat-view-spec-${size}`);
		await open.click();

		const modal = page.getByRole('dialog', { name: new RegExp(attachment.title) });
		const document = modal.getByRole('region', { name: 'Document' });
		await expect(document.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(document.getByRole('table').first()).toBeVisible();
		await expect(document.locator('.spec-diagram svg').first()).toBeVisible({ timeout: 30000 });
		await expect(document.locator('[data-diagram="failed"]')).toHaveCount(0);
		await expect(document.locator('code.language-mermaid')).toHaveCount(0, { timeout: 30000 });

		const answers = modal.getByRole('region', { name: 'Answer' });
		await expect(answers.getByRole('button', { name: /Approve and start/ })).toBeInViewport();
		await expect(answers.getByRole('button', { name: /Other/ })).toBeAttached();
		// Wide tables and diagrams scroll inside themselves; the document never scrolls sideways.
		const sideways = await document.evaluate((el) => el.scrollWidth - el.clientWidth);
		expect(sideways).toBeLessThanOrEqual(1);
		await shot(page, `hub-view-spec-${size}`);

		await document.locator('table').first().scrollIntoViewIfNeeded();
		await shot(page, `hub-view-spec-table-${size}`);
		await document.locator('.spec-diagram').first().scrollIntoViewIfNeeded();
		await shot(page, `hub-view-spec-diagram-${size}`);

		if (!proof) {
			expect(await page.evaluate(() => 'specRan' in window)).toBe(false);
			expect(outside).toEqual([]);
			await expect(document.locator('script, form, input, [onerror]')).toHaveCount(0);
			await expect(document.getByRole('img', { name: 'sketch' })).toHaveAttribute('src', pixel);
			await expect(document.getByText('[Image not included: remote]')).toBeVisible();
			await expect(document.locator('a[href^="javascript"]')).toHaveCount(0);
			await expect(document.getByRole('link', { name: 'good' })).toHaveAttribute(
				'rel',
				'noopener noreferrer'
			);
		}

		// Escape in the Other modal returns to the spec, which stays open.
		await answers.getByRole('button', { name: /Other/ }).click();
		const other = page.getByRole('dialog', { name: 'Other answer' });
		await expect(other).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(other).toBeHidden();
		await expect(modal).toBeVisible();

		await answers.getByRole('button', { name: /Ask for changes/ }).click();
		await expect(modal).toBeHidden();
		await expect.poll(() => fixture.sent.length).toBe(1);
		expect(fixture.sent[0]).toMatchObject({ agentId: 'notes', kind: 'answer', option: 3 });
	});
}
