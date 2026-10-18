import { expect, type Page } from '@playwright/test';
import { at, explorer, tip, verdict } from './explorer';
import { screenStates } from './explorerScreens';
import { searchStates } from './explorerSearch';
import { shellStates } from './explorerShells';
import { seeded, short } from './harnessHistory';

const { commits, keptBranch } = seeded();
const { explorerBranch, explorerUnits: units } = explorer();
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const content = (page: Page) => page.locator('.ex-content');
const titled = (page: Page, name: string) =>
	expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
const measured = (page: Page) =>
	expect(page.getByRole('table', { name: 'Measurements and frozen limits' })).toBeVisible();

/**
 * How each state of the explorer scenario is reached in the synthetic history. Every state is a
 * real address of the explorer; none is put together from parts of another revision.
 */
const asked = new Map<string, string>();
/** The address the latest reach of a state asked for. */
export const askedFor = (state: string) => {
	return asked.get(state) ?? '';
};
/** The states whose flow is also recorded as end-to-end evidence, with what each must find. */
export const explorerFlows: Record<string, { expects: string; source?: boolean }> = {
	pages: { expects: 'Wait for the Pages catalog' },
	contract: { expects: 'Wait for the contract fields at the branch tip' },
	'contract-commit': { expects: 'Wait for the contract fields at the selected commit' },
	function: { expects: 'Wait until the behaviour of the function is compared with its parent' },
	history: { expects: 'Wait for the commits that changed the function' },
	gap: { expects: 'Wait for the mark of a function nobody verified' },
	missing: { expects: 'Wait for the notice that the entity is absent' },
	source: { expects: 'Wait for the source ownership that was asked for', source: true },
	'shell-redirect': {
		expects: 'Wait for the shell under Shells, with the source that was asked for',
		source: true
	}
};

const reaches: Record<string, (page: Page) => Promise<void>> = {
	async contract(page) {
		await page.goto(tip(explorerBranch, `functions/${units.slugify}?tab=contract`));
		await expect(page.getByRole('region', { name: 'Contract', exact: true })).toBeVisible();
	},
	async 'contract-commit'(page) {
		await page.goto(at('main', commits.approved, `functions/${units.slugify}?tab=contract`));
		await expect(page.getByRole('region', { name: 'Contract', exact: true })).toBeVisible();
	},
	// The six categories, pages first, at a verified commit.
	async pages(page) {
		await page.goto(at('main', commits.approved, 'pages'));
		await titled(page, 'Pages');
	},
	// One current screenshot of a page at a branch tip that was verified.
	async 'page-current'(page) {
		await page.goto(tip(explorerBranch, `pages/${units.page}`));
		await expect(
			content(page).getByText(`Current snapshot · ${short(commits.approved)}`)
		).toBeVisible();
	},
	// The parent's and the selected commit's screenshots of the same state and viewport.
	async 'page-commit'(page) {
		await page.goto(at(keptBranch, commits.twin, `pages/${units.page}`));
		await expect(
			page.getByRole('figure', { name: `After · ${short(commits.twin)}` })
		).toBeVisible();
	},
	// The former address opens Overview; each direction is offered as its own tab.
	async relationships(page) {
		await page.goto(at('main', commits.approved, `pages/${units.page}?tab=relationships`));
		await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		for (const name of ['Used In', 'Uses'])
			await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
	},
	// What uses a component, the page that shows it too, in a section of its own.
	async 'used-in'(page) {
		await page.goto(at('main', commits.approved, `components/${units.list}?tab=used-in`));
		await expect(content(page).getByRole('region', { name: 'Used In', exact: true })).toBeVisible();
	},
	// What a page uses, kind by kind, in a section of its own.
	async uses(page) {
		await page.goto(at('main', commits.approved, `pages/${units.page}?tab=uses`));
		await expect(content(page).getByRole('region', { name: 'Uses', exact: true })).toBeVisible();
	},
	async component(page) {
		await page.goto(at('main', commits.approved, `components/${units.list}`));
		await titled(page, 'Title list');
	},
	// A function whose recorded end-to-end result changed against its parent.
	async function(page) {
		await page.goto(at('main', commits.shout, `functions/${units.slugify}`));
		await expect(
			content(page).getByRole('status').filter({ hasText: 'Behavior changed' })
		).toBeVisible();
	},
	async service(page) {
		await page.goto(at('main', commits.approved, 'services/service.clock'));
		await titled(page, 'Clock service');
	},
	async config(page) {
		await page.goto(at('main', commits.approved, `configs/${units.config}`));
		await titled(page, 'Titles config');
	},
	// Details open on the contract; no file of the unit is shown.
	async details(page) {
		await page.goto(at('main', commits.approved, `functions/${units.slugify}/details`));
		await expect(
			content(page).getByRole('heading', { name: 'Contract', exact: true })
		).toBeVisible();
	},
	// Source is shown only here, after it was asked for.
	async source(page) {
		await page.goto(at('main', commits.approved, `functions/${units.slugify}/details?tab=source`));
		await expect(content(page).getByText('src/utils/slugify.ts').first()).toBeVisible();
	},
	// The commits that changed a function, with its growth and the approval of it.
	async history(page) {
		await page.goto(at('main', commits.approved, `functions/${units.slugify}/history`));
		await expect(content(page).getByText('Budget increase approved').first()).toBeVisible();
	},
	// Recorded audio with its transcript, in the tests of the service it belongs to.
	async media(page) {
		await page.goto(at('main', commits.approved, `services/${units.service}`));
		await expect(content(page).getByText('Synthetic test tone. No speech.').first()).toBeVisible();
	},
	// Audio the newest record rejected: it stays to be seen and fails the service.
	async rejected(page) {
		await page.goto(at('main', commits.restated, `services/${units.service}`));
		await expect(
			content(page)
				.getByText(/Rejected capture/)
				.first()
		).toBeVisible();
	},
	// A tip nobody verified: nothing is assumed to pass.
	async gap(page) {
		await page.goto(tip('main', `functions/${units.slugify}`));
		await expect(verdict(page, 'Evidence missing').first()).toBeVisible();
	},
	// What a commit removed is listed from its parent, where it last was.
	async removed(page) {
		await page.goto(at('main', commits.removed, 'functions'));
		await expect(verdict(page, 'Removed at this commit').first()).toBeVisible();
	},
	// An entity that is not at a revision stays absent; no other revision is shown.
	async missing(page) {
		await page.goto(at('main', commits.baseline, 'functions/function.extra'));
		await expect(
			page.getByText('Nothing from another revision is shown in its place.')
		).toBeVisible();
	},
	// Complexity nobody counted: unavailable and not frozen, never zero.
	async unavailable(page) {
		await page.goto(
			at(keptBranch, commits.measured, 'functions/kernel.counter/details?tab=measurements')
		);
		await measured(page);
	},
	// Each emitted size with the limit of its own target.
	async emitted(page) {
		await page.goto(
			at(keptBranch, commits.packed, 'functions/function.packer/details?tab=measurements')
		);
		await measured(page);
	},
	// An output that is no longer built: unavailable with its reason.
	async 'emitted-gone'(page) {
		await page.goto(
			at(keptBranch, commits.vanished, 'functions/function.packer/details?tab=measurements')
		);
		await measured(page);
	},
	...screenStates,
	...shellStates,
	...searchStates,
	// A catalog of several hundred generated units.
	async hundreds(page) {
		await page.goto(`${scale}${tip('main', 'functions')}`);
		await titled(page, 'Functions');
		await expect(content(page).getByRole('article').first()).toBeVisible();
		expect(await content(page).getByRole('article').count()).toBeGreaterThan(400);
	}
};

/** Each state, reached through one address that is kept so its flow can say what was asked. */
export const explorerStates: Record<string, (page: Page) => Promise<void>> = Object.fromEntries(
	Object.entries(reaches).map(([state, reach]) => [
		state,
		async (page: Page) => {
			const asking = (request: { url(): string; isNavigationRequest(): boolean }) => {
				if (request.isNavigationRequest() && !asked.has(`pending ${state}`)) {
					const url = new URL(request.url());
					asked.set(`pending ${state}`, url.pathname + url.search);
				}
			};
			asked.delete(`pending ${state}`);
			page.on('request', asking);
			await reach(page);
			page.off('request', asking);
			asked.set(state, asked.get(`pending ${state}`) ?? '');
		}
	])
);
