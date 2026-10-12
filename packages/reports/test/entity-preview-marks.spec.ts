import { expect, test, type Page } from '@playwright/test';
import { capture, fits, open, shown, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const filter = { category: 'functions' as const, entity: ids.filter };
const components = { category: 'components' as const, commit: commits.middle };
const why = 'Orders page over synthetic orders: empty has no result in the record.';
const tip = (tab: Page) => tab.getByRole('tooltip');

/** True when the open tooltip lies wholly inside the window. */
async function inside(tab: Page, size: { width: number; height: number }): Promise<boolean> {
	const box = (await tip(tab).boundingBox()) ?? { x: -1, y: -1, width: 0, height: 0 };
	const across = box.x >= 0 && box.x + box.width <= size.width;
	return across && box.y >= 0 && box.y + box.height <= size.height;
}

for (const [name, size] of Object.entries(viewports)) {
	test(`components at ${name}: a verdict is the mark alone, told on hover and by the keyboard`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		await open(tab, components, 'partial');
		const row = tab.locator('.ex-table tbody tr').filter({ hasText: 'Order list' });
		const mark = row.getByRole('button', { name: 'Coverage incomplete' });
		await expect(mark).toBeVisible();
		// No status is written beside any mark, and nothing is told before it is asked for.
		expect((await shown(tab, '.hx-verdict')).join('')).toBe('');
		await expect(tip(tab)).toHaveCount(0);
		await capture(tab, `marks-collapsed-${name}`);
		await mark.hover();
		await expect(tip(tab)).toHaveText(`Coverage incomplete${why}`);
		expect(await inside(tab, size)).toBe(true);
		expect(await fits(tab)).toBe(true);
		await capture(tab, `marks-open-${name}`);
		await tab.mouse.move(1, 1);
		await expect(tip(tab)).toHaveCount(0);
		// The keyboard reaches the mark after the title of its row, and Escape closes what it told.
		await row.getByRole('link', { name: 'Order list', exact: true }).focus();
		await tab.keyboard.press('Tab');
		await expect(mark).toBeFocused();
		await expect(tip(tab)).toContainText(why);
		await tab.keyboard.press('Escape');
		await expect(tip(tab)).toHaveCount(0);
	});
}

test('a tap opens what a mark tells, and a tap elsewhere closes it', async ({ browser }) => {
	const context = await browser.newContext({ hasTouch: true, viewport: viewports.mobile });
	const tab = await context.newPage();
	await open(tab, components, 'partial');
	const row = tab.locator('.ex-table tbody tr').filter({ hasText: 'Order list' });
	await row.getByRole('button', { name: 'Coverage incomplete' }).tap();
	await expect(tip(tab)).toContainText(why);
	expect(await inside(tab, viewports.mobile)).toBe(true);
	await tab.getByRole('heading', { level: 1, name: 'Components' }).tap();
	await expect(tip(tab)).toHaveCount(0);
	await context.close();
});

test('every collection, a header, the tests and a history show marks without status words', async ({
	page: tab
}) => {
	const page = { category: 'pages' as const, entity: ids.page, commit: commits.middle };
	const places = [
		{ category: 'pages' as const, commit: commits.middle },
		{ category: 'functions' as const, commit: commits.middle },
		{ category: 'configs' as const, commit: commits.middle },
		{ category: 'services' as const, commit: commits.middle },
		page,
		{ ...page, tab: 'tests' as const },
		{ ...page, tab: 'relationships' as const },
		{ ...filter, section: 'history' as const, commit: commits.middle }
	];
	for (const [position, place] of places.entries()) {
		await open(tab, place, 'partial');
		const marks = await shown(tab, '.hx-verdict');
		expect(marks.length, `marks at place ${position}`).toBeGreaterThan(0);
		expect(marks.join(''), `words beside a mark at place ${position}`).toBe('');
		expect(await fits(tab)).toBe(true);
	}
	// The header of the page tells its status and its reason when its mark is asked.
	await open(tab, page, 'partial');
	await tab.locator('.ex-head').getByRole('button', { name: 'Coverage incomplete' }).hover();
	await expect(tip(tab)).toHaveText(`Coverage incomplete${why}`);
	await capture(tab, 'marks-header-open-desktop');
	// The missing evidence itself stays written where the tests are read.
	await open(tab, { ...page, tab: 'tests' }, 'partial');
	await expect(tab.getByRole('list', { name: 'Why it is not proven' })).toContainText(why);
	await capture(tab, 'marks-tests-desktop');
});

for (const [name, size] of Object.entries(viewports)) {
	test(`a long legacy history stays short at ${name}, and opens in full on request`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		await open(tab, { ...filter, section: 'history', commit: commits.middle }, 'legacy');
		const row = tab.locator('.ex-history tbody tr').first();
		const [behavior] = await shown(tab, '.ex-history tbody tr:first-child td.ex-said');
		const said = behavior.replace(/Full reasons$/, '').trim();
		expect(said.endsWith('…')).toBe(true);
		expect(said.split(/\s+/).length).toBeLessThanOrEqual(30);
		expect([...said].length).toBeLessThanOrEqual(200);
		const full = tab.locator('#ex-reasons-full');
		await expect(full).not.toHaveAttribute('open');
		await expect(tab.getByText('unit 70').first()).toBeHidden();
		expect(await fits(tab)).toBe(true);
		// A wide window shows every column of the history at once, without scrolling inside it.
		const scroller = tab.locator('.ex-scroll').filter({ has: tab.locator('.ex-history') });
		const spare = await scroller.evaluate((box) => box.clientWidth - box.scrollWidth);
		if (name === 'desktop') expect(spare).toBeGreaterThanOrEqual(0);
		await capture(tab, `history-long-short-${name}`);
		// The keyboard opens the reasons as they were written, and lands on them.
		await row.getByRole('button', { name: 'Full reasons of bbbbbbb' }).press('Enter');
		await expect(full).toHaveAttribute('open');
		await expect(full.locator('summary')).toBeFocused();
		for (const symbol of ['cpuSample', 'cpuClient', 'cpuGroups', 'cpuHistory']) {
			const note = new RegExp(
				`Register ${symbol} of the analytics CPU client beside .* unit 70\\.`
			);
			await expect(full.getByText(note)).toBeVisible();
		}
		await expect(full.getByText('Registration only; implementation unchanged.')).toHaveCount(1);
		await expect(full.getByText('performance, improved')).toBeVisible();
		await expect(tab.getByText('src/utils')).toHaveCount(0);
		expect(await fits(tab)).toBe(true);
		await capture(tab, `history-long-full-${name}`);
		await full.locator('summary').press('Enter');
		await expect(full).not.toHaveAttribute('open');
	});
}

test('the overview of a long legacy change is short too, with the same reasons to open', async ({
	page: tab
}) => {
	await open(tab, { ...filter, commit: commits.middle }, 'legacy');
	const change = tab.locator('.ex-change');
	const [said] = await shown(tab, '.ex-change > span:not(.hx-verdict)');
	expect(said.endsWith('…')).toBe(true);
	expect(said.split(/\s+/).length).toBeLessThanOrEqual(30);
	await expect(change.getByText('unit 70').first()).toBeHidden();
	await capture(tab, 'overview-long-short-desktop');
	await change.locator('summary').click();
	await expect(change.getByText(/Register cpuGroups .* unit 70\./)).toBeVisible();
	expect(await fits(tab)).toBe(true);
});

test('a recorded clip plays on the overview: one at the tip, a pair at a commit', async ({
	page: tab
}) => {
	await open(tab, filter);
	const current = tab.getByRole('region', { name: 'Current audio' });
	const clip = current.locator('audio');
	await expect(clip).toHaveCount(1);
	await expect(clip).toHaveAttribute('src', '/media/ccccccc-match-audio.wav');
	await expect(current.getByText('Order filed.')).toBeVisible();
	// The clip is sound a browser decodes and plays, not a name of a file.
	await clip.evaluate((audio: HTMLAudioElement) => ((audio.muted = true), audio.play()));
	await expect
		.poll(() => clip.evaluate((audio: HTMLAudioElement) => audio.currentTime))
		.toBeGreaterThan(0);
	expect(await clip.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeCloseTo(2, 1);
	await capture(tab, 'audio-current-desktop');
	await open(tab, { ...filter, commit: commits.middle });
	const compared = tab.getByRole('region', { name: 'Audio comparison' });
	const sources = compared.locator('audio');
	await expect(sources).toHaveCount(2);
	await expect(compared.getByRole('group', { name: 'Before · aaaaaaa' })).toBeVisible();
	await expect(compared.getByRole('group', { name: 'After · bbbbbbb' })).toBeVisible();
	expect(await sources.evaluateAll((all) => all.map((audio) => audio.getAttribute('src')))).toEqual(
		['/media/aaaaaaa-match-audio.wav', '/media/bbbbbbb-match-audio.wav']
	);
	// Starting the second clip stops the first, so two sides are never heard at once.
	const play = (audio: HTMLAudioElement) => ((audio.muted = true), audio.play());
	await sources.first().evaluate(play);
	await sources.last().evaluate(play);
	await expect
		.poll(() => sources.first().evaluate((audio: HTMLAudioElement) => audio.paused))
		.toBe(true);
	await capture(tab, 'audio-commit-desktop');
});

test('a title that wraps onto two lines is one solid area to press', async ({ page: tab }) => {
	await tab.setViewportSize(viewports.mobile);
	await open(tab, components);
	// A narrow name column wraps the title, as a long name does in a real registry.
	await tab.addStyleTag({ content: '.ex-row-name > span { width: 4.2em; }' });
	const title = tab.getByRole('link', { name: 'Order list', exact: true });
	const box = (await title.boundingBox()) as {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	const line = await title.evaluate((link) => parseFloat(getComputedStyle(link).lineHeight));
	expect(box.height).toBeGreaterThan(line * 1.5);
	// A press in the middle of the title, between its two lines, opens the entity.
	await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	expect(await where(tab)).toEqual({
		branch: 'feature/orders',
		commit: commits.middle,
		category: 'components',
		entity: ids.list
	});
	// So does a press at the end of the shorter line, where a line of text alone would be empty.
	await open(tab, components);
	await tab.addStyleTag({ content: '.ex-row-name > span { width: 4.2em; }' });
	const again = (await title.boundingBox()) as {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	await tab.mouse.click(again.x + again.width - 2, again.y + again.height - 3);
	expect(await where(tab)).toMatchObject({ entity: ids.list });
});
