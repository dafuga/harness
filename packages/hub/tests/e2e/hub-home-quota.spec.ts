import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';

/** The quota a person reads at a glance: header pills, card and dialog, down to nothing left. */
test.setTimeout(60000);

/** Review screenshots are written only when HUB_QUOTA_SHOTS names a directory. */
async function capture(page: Page, name: string) {
	const directory = process.env.HUB_QUOTA_SHOTS;
	if (directory) await page.screenshot({ path: `${directory}/${name}.png` });
}

async function home(page: Page, width: number) {
	await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	const fixture = await hubHomeFixture(page, 'default');
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	return fixture;
}

function card(page: Page, title: string) {
	return page.getByRole('region', { name: title, exact: true });
}

async function openDialog(page: Page, title: string) {
	await card(page, title)
		.getByRole('button', { name: /^(See all|All \d+)/ })
		.click();
	const dialog = page.getByRole('dialog', { name: title, exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
}

/** Daniel's own two subscriptions: Claude with room left, Codex with the given weekly room left. */
async function twoSubscriptions(page: Page, codexLeft: number, width = 1440) {
	const fixture = await home(page, width);
	const [first] = fixture.snapshot.providers.quota!;
	const limit = (id: string, label: string, left: number) => ({
		id,
		label,
		left,
		resetsAt: '2026-11-24T10:39:00.000Z'
	});
	fixture.snapshot.providers.quota = [
		{
			...first,
			id: 'claude',
			provider: 'claude',
			limits: [
				limit('session', '5-hour window', 62),
				limit('weekly', 'Weekly', 41),
				limit('weekly-fable', 'Weekly Fable', 80)
			]
		},
		{ ...first, id: 'codex', provider: 'codex', limits: [limit('secondary', 'Weekly', codexLeft)] }
	];
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	return fixture;
}

function quotaPills(page: Page) {
	return page.getByRole('list', { name: 'Subscription quota' }).getByRole('button');
}

for (const width of [1440, 390])
	test(`header shows both subscriptions and an empty one is out of quota at ${width}px`, async ({
		page
	}) => {
		await twoSubscriptions(page, 0, width);
		const heading = page.locator('.hh-heading');
		await expect(heading).toContainText('Out of quota');
		await expect(heading).not.toContainText('Almost out');
		await expect(quotaPills(page)).toHaveCount(2);
		const claude = quotaPills(page).filter({ hasText: 'Claude' });
		const codex = quotaPills(page).filter({ hasText: 'Codex' });
		await expect(claude).toHaveText('Claude 5h 62% left · weekly 41% left');
		await expect(codex).toHaveText('Out of quota Codex weekly · resets Tue 24 Nov 10:39 Lisbon');
		for (const pill of [claude, codex]) {
			const box = (await pill.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
		}
		await capture(page, `quota-pills-out-${width}`);
		const meaning = 'Codex weekly: OpenAI Codex subscription weekly limit.';
		await expect(codex).toHaveAttribute('title', meaning);
		await expect(claude).toHaveAttribute('title', /Claude Code subscription 5-hour limit/);
		await expect(page.getByText(meaning, { exact: true })).toHaveCount(0);
		await codex.click();
		await expect(codex).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByText(meaning, { exact: true })).toBeVisible();
		await capture(page, `quota-pills-explained-${width}`);
		await codex.click();
		await expect(page.getByText(meaning, { exact: true })).toHaveCount(0);
	});

test('an empty limit reads out of quota in the card and the dialog too', async ({ page }) => {
	await twoSubscriptions(page, 0);
	const quota = card(page, 'Quota');
	await expect(quota.getByText('1 out of quota', { exact: true })).toBeVisible();
	await expect(quota.locator('.hh-q-callout')).toContainText('Out of quota');
	await expect(quota).not.toContainText('Almost out');
	const [callout, next] = await Promise.all([
		quota.locator('.hh-q-callout').boundingBox(),
		quota.locator('.hh-q-sub').first().boundingBox()
	]);
	expect(next!.y - (callout!.y + callout!.height)).toBeGreaterThanOrEqual(12);
	await capture(page, 'quota-card-out');
	const dialog = await openDialog(page, 'Quota');
	await expect(dialog.getByText('Out of quota', { exact: true }).first()).toBeVisible();
	await expect(dialog.getByText('2 subscriptions · 1 out of quota', { exact: true })).toBeVisible();
	await expect(dialog).not.toContainText('Almost out');
	await capture(page, 'quota-dialog-out');
});

for (const [left, word] of [
	[1, 'Almost out'],
	[9, 'Almost out'],
	[10, 'Low']
] as const)
	test(`${left}% left reads ${word} in the header`, async ({ page }) => {
		await twoSubscriptions(page, left);
		await expect(quotaPills(page).filter({ hasText: 'Codex' })).toHaveText(
			`${word} Codex weekly ${left}% left`
		);
		await expect(page.locator('.hh-heading')).not.toContainText('Out of quota');
	});

test('a subscription with no current reading says its usage is unknown', async ({ page }) => {
	const fixture = await twoSubscriptions(page, 50);
	const [claude, codex] = fixture.snapshot.providers.quota!;
	fixture.snapshot.providers.quota = [{ ...codex }];
	await page.reload();
	await expect(quotaPills(page).filter({ hasText: 'Claude' })).toHaveText('Claude usage unknown');
	fixture.snapshot.providers.quota = [{ ...claude, readAt: '2026-11-21T19:30:00.000Z' }, codex];
	await page.reload();
	await expect(quotaPills(page).filter({ hasText: 'Claude' })).toHaveText('Claude usage unknown');
	await expect(quotaPills(page).filter({ hasText: 'Codex' })).toHaveText('Codex weekly 50% left');
});
