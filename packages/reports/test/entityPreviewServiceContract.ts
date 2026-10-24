import { expect, type Locator, type Page } from '@playwright/test';
import { capture, fits, open, viewports } from './entityPreviewPage';
import { agentActivity, orderFeed } from './entityServiceContract';

const shot = (name: string) => `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}`;

/** AgentActivityService as declared now: its constructor, then each method, by signature. */
const agentMethods = [
	['constructor', 'constructor(root, checkouts)'],
	['register', 'register(input)'],
	['heartbeat', 'heartbeat(id, input)'],
	['finish', 'finish(id, failed, outcome)'],
	['roster', 'roster()']
] as const;

/**
 * A service contract is read by method at desktop and phone widths: AgentActivityService shows
 * every method it declares now and an invented service, titled apart from its class, its
 * initialize method, each with its own parameters, return and errors, and no class-wide Inputs,
 * Outputs table remains; errors follow the methods in one table.
 */
export async function reviewServiceContract(page: Page): Promise<void> {
	for (const viewport of ['desktop', 'mobile'] as const) {
		await page.setViewportSize(viewports[viewport]);
		await reviewAgentActivity(page, viewport);
		await reviewInitialize(page, viewport);
	}
}

/** The Contract tab of a service, opened at its address in the tip of the branch. */
async function contractOf(page: Page, entity: string): Promise<Locator> {
	await open(page, { category: 'services', entity, tab: 'contract' }, 'declared');
	const pane = page.getByRole('tabpanel', { name: / contract$/ });
	await expect(pane).toBeVisible();
	return pane;
}

/** The method sections of a contract, as each is announced, in the order they are shown. */
const methodsOf = (pane: Locator) =>
	pane
		.getByRole('region', { name: / method$/ })
		.evaluateAll((all) => all.map((node) => node.getAttribute('aria-label')));

const methodIn = (pane: Locator, name: string) =>
	pane.getByRole('region', { name: `${name} method`, exact: true });

/** The former rendering had one table of each for the whole class; it would fail here. */
async function withoutClassGroups(pane: Locator): Promise<void> {
	for (const name of ['Inputs', 'Outputs'])
		await expect(pane.getByRole('table', { name, exact: true })).toHaveCount(0);
}

async function reviewAgentActivity(page: Page, viewport: string): Promise<void> {
	const pane = await contractOf(page, agentActivity.id);
	await capture(page, shot(`service-contract-methods-${viewport}`), [
		'reports.component.entity-contract'
	]);
	expect(await methodsOf(pane)).toEqual(agentMethods.map(([name]) => `${name} method`));
	await withoutClassGroups(pane);
	for (const [name, signature] of agentMethods) {
		const method = methodIn(pane, name);
		await expect(method.getByRole('heading', { level: 3 })).toHaveText(signature);
		await expect(method.getByRole('table', { name: 'Throws', exact: true })).toHaveCount(0);
	}
	const heartbeat = methodIn(pane, 'heartbeat');
	const parameters = heartbeat.getByRole('table', { name: 'Parameters', exact: true });
	await expect(parameters.getByRole('rowheader')).toHaveText(['id', 'input']);
	const returned = heartbeat.getByRole('table', { name: 'Returns', exact: true });
	await expect(returned).toContainText('Promise<AgentBeat>');
	const roster = methodIn(pane, 'roster').getByRole('table', { name: 'Parameters', exact: true });
	await expect(roster).toContainText('No parameters.');
	const built = methodIn(pane, 'constructor');
	await expect(built.getByRole('table', { name: 'Returns', exact: true })).toHaveCount(0);
	await expect(built.getByText('Creates the service.')).toBeVisible();
	// What no one method declares, and how the class runs, are said once beside the methods.
	await expect(pane.getByRole('table', { name: 'Errors', exact: true })).toContainText(
		'ExpectedCliError'
	);
	await expect(pane.getByText('Errors not tied to a method', { exact: true })).toHaveCount(0);
	expect(
		await pane.evaluate((root) => {
			const methods = root.querySelectorAll('[aria-label$=" method"]');
			const errors = root.querySelector('table[aria-label="Errors"]');
			if (!errors) return false;
			return Boolean(methods[methods.length - 1].compareDocumentPosition(errors) & 4);
		})
	).toBe(true);
	await expect(pane.getByText('Runs as', { exact: true })).toHaveCount(1);
	expect(await fits(page)).toBe(true);
}

/** OrderFeed's methods come from its recorded class, though its unit is titled otherwise. */
async function reviewInitialize(page: Page, viewport: string): Promise<void> {
	expect(orderFeed.title).not.toContain(orderFeed.className);
	const pane = await contractOf(page, orderFeed.id);
	await capture(page, shot(`service-contract-initialize-${viewport}`), [
		'reports.component.entity-contract'
	]);
	const names = ['constructor method', 'initialize method', 'latest method'];
	expect(await methodsOf(pane)).toEqual(names);
	await expect(methodIn(pane, 'constructor').getByRole('heading', { level: 3 })).toHaveText(
		'constructor(accountId)'
	);
	await expect(methodIn(pane, 'latest').getByRole('heading', { level: 3 })).toHaveText('latest()');
	await withoutClassGroups(pane);
	const initialize = methodIn(pane, 'initialize');
	await expect(initialize.getByRole('heading', { level: 3 })).toHaveText('initialize(timeoutMs)');
	const parameters = initialize.getByRole('table', { name: 'Parameters', exact: true });
	await expect(parameters.getByRole('rowheader')).toHaveText(['timeoutMs']);
	const returned = initialize.getByRole('table', { name: 'Returns', exact: true });
	await expect(returned).toContainText('Promise<void>');
	const thrown = pane.getByRole('table', { name: 'Errors', exact: true });
	await expect(pane.getByRole('table', { name: 'Throws', exact: true })).toHaveCount(0);
	await expect(thrown).toContainText('OrderFeed.initialize.timeout');
	await expect(thrown).toContainText('TimeoutError');
	const latest = methodIn(pane, 'latest');
	await expect(latest).not.toContainText('TimeoutError');
	await expect(latest.getByRole('table', { name: 'Throws', exact: true })).toHaveCount(0);
	const example = parameters.getByRole('button', { name: 'View example for timeoutMs' });
	await example.click();
	const dialog = page.getByRole('dialog', { name: 'Example for initialize · timeoutMs' });
	await expect(dialog).toContainText('500');
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(example).toBeFocused();
	expect(await fits(page)).toBe(true);
}
