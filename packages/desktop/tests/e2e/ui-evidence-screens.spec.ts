import { componentScreens, runtimeEvidence } from './runtime-evidence';
import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import {
	branch,
	cardScenario,
	commits,
	evidenceFixture,
	evidenceState,
	ids,
	pinned,
	sharedProject,
	tones
} from './ui-evidence-fixture';

/**
 * Recorded runtime screenshots in the shared viewer, read through the two evidence reads of a
 * synthetic backend: one capture at a branch tip, the commit beside its first parent at a named
 * commit, and each gap in the words the record gives it. Designs stay on their own tab.
 */
const short = (commit: string) => commit.slice(0, 7);
const at = (entity: string, commit?: string, suffix = '') =>
	`/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}` +
	`${commit ? `/commit/${commit}` : ''}/${entity}${suffix}`;
const pageAt = (commit?: string, suffix = '') => at(`pages/${ids.page}`, commit, suffix);
const runtime = (page: Page) => page.getByRole('region', { name: 'Recorded runtime evidence' });
const shot = 'orders-page · default at desktop';

/** What an image really shows: its own size and the colour in its middle, read from its pixels. */
function drawn(image: Locator) {
	return image.evaluate(async (node: HTMLImageElement) => {
		await node.decode();
		const canvas = document.createElement('canvas');
		[canvas.width, canvas.height] = [node.naturalWidth, node.naturalHeight];
		const context = canvas.getContext('2d')!;
		context.drawImage(node, 0, 0);
		const middle = context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
		return { width: canvas.width, height: canvas.height, tone: [...middle.slice(0, 3)] };
	});
}

test('a page at its branch tip shows one current screenshot beside its contract, apart from its designs', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(pageAt());
	const tabs = page.getByRole('navigation', { name: 'Entity sections' });
	const names = ['Overview', 'APIs', 'Designs', 'Used In', 'Uses', 'States', 'History', 'Source'];
	await expect(tabs.getByRole('button')).toHaveText(names);
	await expect(tabs.getByRole('button', { name: 'Overview' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('heading', { name: 'Contract', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Size & performance' })).toBeVisible();
	const shown = runtime(page);
	await expect(shown.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await expect(shown.getByText('Runtime capture', { exact: true })).toBeVisible();
	await expect(shown.getByRole('figure')).toHaveCount(1);
	const current = shown.getByRole('figure', { name: `Current snapshot · ${short(commits.tip)}` });
	await expect(current.getByText('Branch tip', { exact: true })).toBeVisible();
	const image = current.getByRole('img', { name: shot });
	expect(await drawn(image)).toEqual({ width: 160, height: 100, tone: tones[commits.tip] });
	await expect(image).toHaveAttribute('src', /^blob:/);
	await expect(current.getByText('Fresh capture · passed')).toBeVisible();
	await expect(shown.getByText(/Before ·|After ·/)).toHaveCount(0);
	// The conversation beside it may name a design; what the overview itself shows is no design.
	await expect(page.getByRole('main').getByRole('img', { name: /v001/ })).toHaveCount(0);
	await runtimeEvidence(page, info, 'current');
	const { calls } = await evidenceState(page);
	const scope = {
		entityId: ids.page,
		commit: commits.tip,
		branch,
		mode: 'current',
		projectId: sharedProject
	};
	expect(calls.filter((call) => call.op === 'evidence')).toEqual([{ op: 'evidence', ...scope }]);
	expect(calls.filter((call) => call.op === 'artifact')).toEqual([
		{
			op: 'artifact',
			...scope,
			side: 'after',
			recordId: 'rec-cccccc-0000',
			scenarioId: 'orders-page',
			state: 'default',
			evidenceId: 'screens',
			viewport: 'desktop',
			sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			notesRevision: pinned.notes,
			evidenceRevision: pinned.evidence
		}
	]);
	await tabs.getByRole('button', { name: 'Designs' }).click();
	await expect.poll(() => new URL(page.url()).pathname).toBe(pageAt(undefined, '/designs'));
	await expect(page.getByRole('img', { name: 'OrdersPage v001 desktop default' })).toBeVisible();
	await expect(page.getByText('Committed design · v001')).toBeVisible();
	await expect(runtime(page)).toHaveCount(0);
});

test('the tip named as a commit is shown beside its first parent, and an older commit beside its own', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(pageAt(commits.tip));
	const shown = runtime(page);
	await expect(shown.getByRole('heading', { name: 'Before and after', exact: true })).toBeVisible();
	const before = shown.getByRole('figure', { name: `Before · ${short(commits.middle)}` });
	const after = shown.getByRole('figure', { name: `After · ${short(commits.tip)}` });
	await expect(before.getByText('Parent commit', { exact: true })).toBeVisible();
	await expect(after.getByText('Selected commit', { exact: true })).toBeVisible();
	expect((await drawn(before.getByRole('img', { name: shot }))).tone).toEqual(
		tones[commits.middle]
	);
	expect((await drawn(after.getByRole('img', { name: shot }))).tone).toEqual(tones[commits.tip]);
	await runtimeEvidence(page, info, 'commit');
	const { calls } = await evidenceState(page);
	expect(calls.filter((call) => call.op === 'evidence')).toMatchObject([
		{ mode: 'commit', commit: commits.tip }
	]);
	const sides = calls.filter((call) => call.op === 'artifact').map((call) => call.side);
	expect(sides.sort()).toEqual(['after', 'before']);
	// What the parent did not capture is its own gap; what the tip rejected is shown as rejected.
	await shown.getByLabel('State', { exact: true }).selectOption('empty');
	await expect(
		before.getByText(`No capture of empty at desktop is recorded for bbbbbbb.`)
	).toBeVisible();
	await expect(before.getByRole('img')).toHaveCount(0);
	await expect(after.getByText('Fresh capture · passed')).toBeVisible();
	await runtimeEvidence(page, info, 'missing');
	await shown
		.getByRole('group', { name: 'Viewport' })
		.getByRole('button', { name: 'mobile' })
		.click();
	await expect(after.getByText('Rejected capture · failed')).toBeVisible();
	await runtimeEvidence(page, info, 'rejected');
	await page.goto(pageAt(commits.middle));
	const parent = shown.getByRole('figure', { name: `Before · ${short(commits.first)}` });
	await expect(
		parent.getByText('No verification record is attached to this commit.')
	).toBeVisible();
	const older = shown.getByRole('figure', { name: `After · ${short(commits.middle)}` });
	expect((await drawn(older.getByRole('img', { name: shot }))).tone).toEqual(tones[commits.middle]);
	await page.goto(pageAt(commits.first));
	const none = 'This is the first commit of its history: there is no parent to compare with.';
	await expect(shown.getByText(none).first()).toBeVisible();
	await expect(shown.getByRole('img')).toHaveCount(0);
	await runtimeEvidence(page, info, 'first-commit');
});

test('an inherited capture is not the current one, and sides that are not alike are not compared', async ({
	page
}, info) => {
	await evidenceFixture(page, { inheritedOnly: true });
	await page.goto(at(`components/${ids.card}`));
	const shown = runtime(page);
	await expect(shown.getByLabel('Scenario', { exact: true }).locator('option')).toHaveText([
		'Order card alone'
	]);
	await expect(shown.getByLabel('Scenario', { exact: true })).toHaveValue(cardScenario);
	const current = shown.getByRole('figure', { name: `Current snapshot · ${short(commits.tip)}` });
	await expect(current.getByText('Inherited from bbbbbbb', { exact: true })).toBeVisible();
	await expect(current.getByText('Inherited capture · passed')).toBeVisible();
	expect((await drawn(current.getByRole('img'))).tone).toEqual(tones[commits.middle]);
	await runtimeEvidence(page, info, 'inherited');
	await componentScreens(page, info, 'current');
	await expect(page.locator('.entity-heading .verification')).toHaveAccessibleName(
		'Full coverage passed'
	);
	await page.goto(at(`components/${ids.card}`, commits.tip));
	await expect(shown.getByRole('heading', { name: 'Before and after, not alike' })).toBeVisible();
	await expect(
		shown.getByText('Order card alone: viewport desktop is 1440×900 before and 1280×900 after.')
	).toBeVisible();
	await expect(shown.getByLabel('Scenario', { exact: true })).toHaveValue(cardScenario);
	const after = shown.getByRole('figure', { name: `After · ${short(commits.tip)}` });
	await expect(after.getByText('Inherited capture · passed')).toBeVisible();
	expect((await drawn(after.getByRole('img'))).tone).toEqual(tones[commits.middle]);
	await runtimeEvidence(page, info, 'not-alike');
	await componentScreens(page, info, 'commit');
});

for (const viewport of [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'tablet', width: 820, height: 1180 }
]) {
	test(`${viewport.name}: both sides stay inside the page and keep their images`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await evidenceFixture(page);
		await page.goto(pageAt());
		await expect(runtime(page).getByRole('img')).toHaveCount(1);
		await runtimeEvidence(page, info, 'current');
		await page.goto(pageAt(commits.tip));
		const shown = runtime(page);
		const figures = shown.getByRole('figure');
		await expect(figures).toHaveCount(2);
		for (const figure of await figures.all()) {
			const box = (await figure.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
			expect((await drawn(figure.getByRole('img'))).width).toBe(160);
		}
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
		await runtimeEvidence(page, info, 'commit');
	});
}
