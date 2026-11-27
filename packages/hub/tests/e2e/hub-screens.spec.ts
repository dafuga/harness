import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { atlas, hostedFixture } from './hosted-fixture';
import { hubHomeFixture } from './hub-home-fixture';
import { overviewFixture } from './tracker-overview-fixture';

/** The UI design patterns on the Hub overviews: actions above one list, forms only in dialogs. */
const sizes = [
	{ id: 'phone', width: 390, height: 844 },
	{ id: 'laptop', width: 1440, height: 900 }
] as const;
test.setTimeout(60_000);

async function box(locator: Locator) {
	const found = await locator.boundingBox();
	if (!found) throw new Error('The element has no layout box.');
	return found;
}

/** Nothing on an overview asks for input until a dialog opens. */
async function overview(page: Page) {
	await expect(page.locator('form, input, select, textarea')).toHaveCount(0);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
}

/** Opens a dialog from its button and proves it fits the screen. */
async function dialog(page: Page, name: string) {
	const opener = page.getByRole('button', { name, exact: true });
	expect((await box(opener)).height).toBeGreaterThanOrEqual(44);
	await opener.click();
	const opened = page.getByRole('dialog', { name });
	await expect(opened).toBeVisible();
	const bounds = await box(opened);
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	return opened;
}

/** One action row sits above the one list card it acts on. */
async function above(action: Locator, list: Locator) {
	const top = await box(list);
	const button = await box(action);
	expect(button.y + button.height).toBeLessThanOrEqual(top.y);
}

const itemLinks = {
	question: `https://example.invalid/decision/${'long-'.repeat(32)}end?view=full#top`,
	title: 'https://example.invalid/item',
	label: 'https://example.invalid/option',
	effect: 'http://example.invalid/explanation',
	note: 'https://example.invalid/note'
};

async function checkLink(scope: Page | Locator, url: string) {
	const link = scope.getByRole('link', { name: url, exact: true }).first();
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('href', url);
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	return link;
}

async function homeWithLinks(page: Page) {
	const fixture = await hubHomeFixture(page, 'default');
	const chief = fixture.snapshot.agents.find((agent) => agent.id === 'cos')!;
	chief.question = `Review (${itemLinks.question}).`;
	chief.options![0] = {
		label: `Approve ${itemLinks.label}`,
		recommended: true,
		effect: `See ${itemLinks.effect}.`
	};
	chief.messages.push({
		id: 'link-note',
		from: 'agent',
		text: `See ${itemLinks.note}. Leave javascript:alert(1) and ftp://example.invalid/file as text.`,
		at: new Date().toISOString()
	});
	if (fixture.snapshot.overview.status !== 'ready') throw new Error('Expected Tracker work');
	for (const project of fixture.snapshot.overview.projects)
		for (const item of project.items) item.title = `Review ${itemLinks.title}`;
	await page.goto('/');
	return fixture;
}

for (const size of sizes) {
	test(`shared projects keep New project in a dialog at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await overviewFixture(page, 'ready');
		await page.goto('/projects');
		const list = page.getByRole('region', { name: 'Your projects' });
		await expect(list.getByRole('link', { name: 'Open Atlas' })).toBeVisible();
		await expect(list.getByRole('link', { name: 'Project overview' })).toBeVisible();
		await expect(page.locator('main button.primary')).toHaveCount(1);
		const create = page.getByRole('button', { name: 'New project', exact: true });
		await above(create, list);
		const name = await box(list.getByRole('link', { name: 'Open Atlas' }));
		const role = await box(list.getByText('owner', { exact: true }));
		expect(name.x).toBeLessThan(role.x);
		await overview(page);
		const opened = await dialog(page, 'New project');
		await expect(opened.getByLabel('Repository', { exact: true })).toBeVisible();
		await expect(opened.getByRole('button', { name: 'Create project' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(opened).toHaveCount(0);
	});

	test(`members invite from a dialog above the people list at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await hostedFixture(page);
		await page.goto(`/projects/${atlas}/members`);
		const people = page.getByRole('region', { name: 'People' });
		await expect(people.getByRole('listitem')).toHaveCount(2);
		await above(page.getByRole('button', { name: 'Invite someone', exact: true }), people);
		await overview(page);
		const opened = await dialog(page, 'Invite someone');
		await expect(opened.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible();
	});

	test(`devices list in one card with full-size remove buttons at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await hostedFixture(page);
		const device = { id: 'fixture-device', name: 'Office Mac', lastSeenAt: '2026-11-23T12:00Z' };
		await page.route('**/api/account/devices', (route) =>
			route.fulfill({ json: { devices: [device], currentDeviceId: null } })
		);
		await page.goto('/devices');
		const list = page.getByRole('region', { name: 'Signed-in devices' });
		const remove = list.getByRole('button', { name: 'Remove Office Mac' });
		await expect(remove).toBeVisible();
		expect((await box(remove)).height).toBeGreaterThanOrEqual(44);
		await overview(page);
	});

	test(`Hub links open apart from Tracker actions at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		const fixture = await homeWithLinks(page);
		const needs = page.getByRole('region', { name: 'Blocked - needs you' });
		const work = page.getByRole('region', { name: 'Work in progress', exact: true });
		await checkLink(work, itemLinks.title);
		const question = await checkLink(needs, itemLinks.question);
		await checkLink(needs, itemLinks.label);
		await expect(needs.locator('button a, a button')).toHaveCount(0);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready.then(() => {}));
			await needs.screenshot({ path: test.info().outputPath(`home-links-${size.id}.png`) });
		}
		await overview(page);
		const bounds = await box(question);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
		expect(bounds.height).toBeGreaterThan(18);
		await page
			.context()
			.route(itemLinks.label, (route) => route.fulfill({ body: 'Choice source' }));
		const popup = page.waitForEvent('popup');
		await needs.getByRole('link', { name: itemLinks.label, exact: true }).click();
		const source = await popup;
		await expect(source.getByText('Choice source')).toBeVisible();
		await source.close();
		expect(fixture.sent).toHaveLength(0);
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await needs.getByRole('button', { name: /View details/ }).click();
		const detail = page.getByRole('region', { name: 'Chat with Chief of Staff' });
		await checkLink(detail, itemLinks.question);
		await checkLink(detail, itemLinks.label);
		await checkLink(detail, itemLinks.effect);
		await checkLink(detail, itemLinks.note);
		await expect(detail.getByText(/javascript:alert/)).toBeVisible();
		await expect(detail.locator('a[href^="javascript:"], a[href^="ftp:"]')).toHaveCount(0);
		await expect(detail.locator('button a, a button')).toHaveCount(0);
	});

	test(`Hub home opens the agent chat from a button at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		await hubHomeFixture(page, 'default');
		await page.goto('/');
		const agents = page.getByRole('region', { name: 'Agents', exact: true });
		await expect(agents.getByText('Chief of Staff').first()).toBeVisible();
		await overview(page);
		await agents.getByRole('button', { name: 'Message an agent', exact: true }).click();
		const chat = page.getByRole('dialog').getByRole('region', { name: 'Chat with Chief of Staff' });
		await expect(chat.getByRole('textbox')).toHaveCount(0);
		await chat.getByRole('button', { name: 'Open chat', exact: true }).click();
		await expect(page.getByRole('textbox', { name: 'Message Chief of Staff' })).toBeVisible();
	});
}
