import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hostedFixture } from './ui-hosted-fixture';
import { alpha, earlier, emitRun, gamma, referenceFixture } from './ui-references-fixture';

/**
 * Agent conversations name units as links: a stored question, streamed text split across events,
 * run progress and a shared project's comment. Only units of the shown project at the shown
 * revision become links; an unknown or hostile reference stays its text. A screenshot is kept
 * before the checks of each place when TAKE_SCREENSHOT=true.
 */
const alphaAt = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const designs = 'pages/page%3Aactivity/designs';
const thread = (page: Page) => page.getByRole('complementary', { name: 'Design conversation' });

async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.REFERENCE_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

async function openThread(page: Page, at: string) {
	await page.goto(alphaAt(at));
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(thread(page).getByText('Alpha: keep the filters on one line.')).toBeVisible();
}

test('the units an agent question names are links, and following one opens a shell under Layouts', async ({
	page
}, info) => {
	await referenceFixture(page);
	await openThread(page, designs);
	await remember(page, info, 'references-question-desktop');
	await expect(thread(page).getByRole('link', { name: 'Order frame', exact: true })).toBeVisible();
	await expect(thread(page).getByRole('link', { name: 'Format time', exact: true })).toBeVisible();
	await expect(thread(page).getByText('[[unit:app.function.missing]]')).toBeVisible();
	await expect(thread(page).getByText('[[unit:javascript:alert(1)]]')).toBeVisible();
	await expect(thread(page).getByRole('link', { name: /missing|javascript/ })).toHaveCount(0);
	await thread(page).getByRole('link', { name: 'Order frame', exact: true }).click();
	await expect(page).toHaveURL(alphaAt('layouts/app.shell.order-frame'));
	await expect(page.getByRole('heading', { level: 1, name: 'Order frame' })).toBeVisible();
});

test('at a pinned commit a reference leads to the unit at that commit', async ({ page }) => {
	await referenceFixture(page);
	await openThread(page, `commit/${earlier}/${designs}`);
	await expect(
		thread(page).getByRole('link', { name: 'Format time', exact: true })
	).toHaveAttribute('href', alphaAt(`commit/${earlier}/functions/app.function.format-time`));
});

test('streamed text shows a reference split across events as text until it is whole, then as a link', async ({
	page
}, info) => {
	await referenceFixture(page);
	await openThread(page, designs);
	await page
		.getByRole('group', { name: 'Request mode' })
		.getByRole('button', { name: 'Plan', exact: true })
		.click();
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Check the frame');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	await emitRun(page, { kind: 'text', text: 'Shall I keep [[unit:app.function.form' });
	const stream = thread(page).getByText('Shall I keep', { exact: false });
	await expect(stream).toContainText('Shall I keep [[unit:app.function.form');
	await expect(stream.getByRole('link')).toHaveCount(0);
	await emitRun(page, { kind: 'text', text: 'at-time]] as it is?' });
	await expect(stream).toHaveText('Shall I keep Format time as it is?');
	await remember(page, info, 'references-stream-desktop');
	await expect(stream.getByRole('link', { name: 'Format time', exact: true })).toHaveAttribute(
		'href',
		alphaAt('functions/app.function.format-time')
	);
});

test('the project agent shows the unit its run is working on as a link', async ({ page }, info) => {
	await referenceFixture(page);
	await page.goto(alphaAt('pages'));
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const agent = page.getByRole('complementary', { name: 'Project agent', exact: true });
	const request = 'Add a refunds page beside [[unit:app.shell.order-frame]]';
	await agent.getByRole('textbox', { name: 'Message', exact: true }).fill(request);
	await agent.getByRole('button', { name: 'Send plan', exact: true }).click();
	const calls = () =>
		page.evaluate(() => (window as unknown as { __calls: Record<string, unknown>[] }).__calls);
	await expect.poll(async () => (await calls()).filter((c) => c.op === 'startRun').length).toBe(1);
	// The request is sent as it was written; only its echo shows the reference as a link.
	expect((await calls()).find((c) => c.op === 'startRun')).toMatchObject({ text: request });
	await expect(agent.getByText(request)).toHaveCount(0);
	await emitRun(page, {
		kind: 'status',
		phase: 'prompting',
		detail: 'Reading [[unit:app.function.format-time]]'
	});
	await expect(agent.getByRole('status')).toHaveText(/Reading Format time/);
	await remember(page, info, 'references-agent-desktop');
	await expect(agent.getByRole('link', { name: 'Order frame', exact: true })).toBeVisible();
	await agent.getByRole('status').getByRole('link', { name: 'Format time', exact: true }).click();
	await expect(page).toHaveURL(alphaAt('functions/app.function.format-time/history'));
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toBeVisible();
});

test('a shared project renders a reference in a comment and offers no agent control', async ({
	page
}) => {
	await referenceFixture(page, hostedFixture);
	await page.goto(`/projects/${gamma}/harness/branch/main/${designs}`);
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(
		thread(page).getByRole('link', { name: 'Gamma frame', exact: true })
	).toHaveAttribute('href', `/projects/${gamma}/harness/branch/main/layouts/app.shell.order-frame`);
	await expect(page.getByRole('button', { name: 'Work with agent', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
});

for (const shown of [
	'pages',
	'functions/app.function.format-time',
	'functions/app.function.format-time/history'
]) {
	test(`the round project chat remains reachable on ${shown}`, async ({ page }, info) => {
		await referenceFixture(page);
		await page.goto(alphaAt(shown));
		const launcher = page.getByRole('button', { name: 'Work with agent', exact: true });
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await remember(page, info, 'persistent-chat-' + shown.replaceAll('/', '-'));
		await expect(launcher).toBeVisible();
		const box = (await launcher.boundingBox())!;
		expect(Math.abs(box.width - box.height), 'round chat bubble').toBeLessThanOrEqual(2);
		await launcher.click();
		const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
	});
}
