import { expect, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { activityFixture } from './activityFixture';
import { fixtures } from './fixtures';
import { activityPayload, manyAgents, type PayloadAgent } from './activityPayload';

/**
 * The states of project activity that evidence keeps: the fixture application as its server
 * reads it, a busy repository as a short first view with its controls opened, and a reading that
 * could not be renewed. The busy and the failing readings are the made-up ones the behaviour
 * tests serve, with the page's clock held; nothing of this machine or its agents is in them.
 */
const api = '**/api/project-activity';
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const list = (page: Page, name: string) => page.getByRole('list', { name, exact: true });
const shown = (page: Page, name: string) => list(page, name).locator('li:visible');
const working = (page: Page) => region(page, 'Working agents').getByTestId('agents-working');
const atTop = (target: Locator) =>
	target.evaluate((element) => element.scrollIntoView({ block: 'start' }));
const held = new WeakSet<Page>();

const git = (cwd: string, args: string[]) =>
	execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/**
 * The fixture history and its agents, with time for the quiet one to have gone quiet. What is
 * returned puts the fixture checkouts back as they were found, so that a suite which runs after
 * this one meets the application without a history or agents of somebody else's making.
 */
export async function activityReady(): Promise<() => void> {
	const checkouts = [fixtures.site('alpha-project'), fixtures.site('alpha-checkout')];
	const marker = join(checkouts[0], '.git', 'activity-fixture.json');
	const found = existsSync(marker) ? [] : checkouts.map((site) => git(site, ['rev-parse', 'HEAD']));
	activityFixture();
	await new Promise((resolve) => setTimeout(resolve, 1500));
	return () => {
		for (const [index, start] of found.entries()) {
			git(checkouts[index], ['reset', '-q', '--hard', start]);
			git(checkouts[index], ['clean', '-fdxq']);
		}
		if (found.length === 0) return;
		git(checkouts[0], ['update-ref', '-d', 'refs/notes/harness']);
		rmSync(marker, { force: true });
		rmSync(join(fixtures.site('beta-project'), '.cache'), { recursive: true, force: true });
	};
}

/** Evidence holds no sample of this machine: the CPU panel is told that it has none. */
const noCpu = (page: Page) =>
	page.route('**/api/analytics-cpu', (route) =>
		route.fulfill({ status: 503, json: { status: 'unavailable' } })
	);

/** The analytics page of the fixture application, as its server reads the repository now. */
async function live(page: Page): Promise<void> {
	await page.unroute(api);
	await noCpu(page);
	await page.goto('/harness/analytics');
	await expect(working(page)).toHaveText('1');
}

/**
 * The page with its clock held, every later reading answered from `answer` at the page's own
 * time, and one reading asked for. `forward` lets the page's time pass.
 */
async function served(page: Page, answer: () => PayloadAgent[] | null) {
	if (!held.has(page)) await page.clock.install({ time: Date.now() });
	held.add(page);
	await page.unroute(api);
	await noCpu(page);
	await page.route(api, async (route) => {
		const agents = answer();
		if (!agents) return route.fulfill({ status: 503, json: {} });
		const at = await page.evaluate(() => Date.now());
		return route.fulfill({ json: activityPayload(at, agents) });
	});
	await page.goto('/harness/analytics');
	const refresh = page.getByRole('button', { name: 'Refresh activity' });
	await refresh.click();
	return { refresh, forward: (seconds: number) => page.clock.fastForward(seconds * 1000) };
}

const busy = (page: Page) => served(page, () => manyAgents);
const owner: PayloadAgent[] = [{ label: 'Owner', state: 'working' }];

/** A reading arrived with one owner working; then readings stop and one more is asked for. */
async function unrenewed(page: Page) {
	let answering = true;
	const reading = await served(page, () => (answering ? owner : null));
	await expect(working(page)).toHaveText('1');
	answering = false;
	await reading.refresh.click();
	const notice = region(page, 'Working agents').getByRole('status');
	await expect(notice).toContainText('could not be read again');
	return reading;
}

export const activityStates: Record<string, (page: Page) => Promise<void>> = {
	// One agent working with its assignment, one that went quiet, one that finished: counted 1.
	async 'activity-agents'(page) {
		await live(page);
		const roster = list(page, 'Agent roster');
		await expect(roster.getByRole('listitem').filter({ hasText: 'Opus session' })).toContainText(
			'service.cart'
		);
		await expect(roster).toContainText('Stale');
		await expect(roster).toContainText('Finished');
		await atTop(region(page, 'Working agents'));
	},
	// What is not committed in the second checkout, then committed files, with their components.
	async 'activity-files'(page) {
		await live(page);
		await expect(list(page, 'Uncommitted files')).toContainText('src/services/CartService.ts');
		await expect(list(page, 'Committed files')).toContainText('function.price');
		await atTop(region(page, 'Recently changed files'));
	},
	// Recent commits, the newest with its components and the reason noted on it disclosed.
	async 'activity-work'(page) {
		await live(page);
		const latest = shown(page, 'Recent commits').first();
		await latest.locator('summary').click();
		await expect(latest.getByText('Prices are tripled.')).toBeVisible();
		await atTop(region(page, 'Recent work'));
	},
	async 'activity-loops'(page) {
		await live(page);
		await expect(list(page, 'Loop types')).toContainText('2 loops · 1 complete · 1 open');
		await atTop(region(page, 'Loop types'));
	},
	// A busy repository: twelve agents, forty-four uncommitted files, a change of 549 components.
	async 'activity-busy'(page) {
		await busy(page);
		await expect(working(page)).toHaveText('12');
		await expect(shown(page, 'Agent roster')).toHaveCount(5);
		await expect(shown(page, 'Uncommitted files')).toHaveCount(6);
		await atTop(region(page, 'Working agents'));
	},
	// The forty assignments of one agent, opened from the four that are named first.
	async 'activity-assignments'(page) {
		await busy(page);
		const first = shown(page, 'Agent roster').first();
		await first.locator('summary').click();
		await expect(first.locator('.pa-chip:visible')).toHaveCount(40);
		await atTop(first);
	},
	// Every commit shown, and the large change opened to its first twelve components.
	async 'activity-expanded'(page) {
		await busy(page);
		const work = region(page, 'Recent work');
		await work.getByRole('button', { name: 'Show all 20 commits' }).click();
		await expect(shown(page, 'Recent commits')).toHaveCount(20);
		const large = shown(page, 'Recent commits').first();
		await large.locator('summary').click();
		await expect(large.locator('.pa-chip:visible')).toHaveCount(12);
		await atTop(work);
	},
	// The last reading stands, marked as the last one that arrived.
	async 'activity-unrefreshed'(page) {
		await unrenewed(page);
		await expect(working(page)).toHaveText('1');
		await atTop(region(page, 'Working agents'));
	},
	// More than a minute later nobody is counted and the owner is not confirmed.
	async 'activity-unknown'(page) {
		const { forward } = await unrenewed(page);
		await forward(70);
		await expect(working(page)).toHaveText('Unknown');
		await expect(shown(page, 'Agent roster').first()).toContainText('Not confirmed');
		await atTop(region(page, 'Working agents'));
	}
};
