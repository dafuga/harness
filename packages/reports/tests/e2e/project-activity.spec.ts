import { expect, test } from '../../../../test/support/browserTest';
import { activityAnswer } from './support/activityAnswer';
import { activityFixture, type ActivityFixture } from './support/activityFixture';
import { fixtures } from './support/fixtures';
import { seeded } from './support/harnessHistory';
import { expectRetired } from './support/portableReport';

/**
 * The analytics page that showed what a site is doing is gone; its addresses lead into the
 * explorer. What it read is still answered: who is working in the checkouts of the hosting
 * application and on what, its loop types, its recent commits with their reasons and the files
 * that changed, committed or not. Nothing of another application is served.
 */
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const locked = (path: string) => `http://127.0.0.1:${lockedPort}${path}`;
const foreign = encodeURIComponent(fixtures.site('beta-project'));
const { commits } = seeded();
const other = /Foreign agent|foreign-model|beta-project/;
let made: ActivityFixture;

test.beforeAll(() => {
	made = activityFixture();
	// The quiet helper stated one second of patience; by now it has said nothing for longer.
	return new Promise((resolve) => setTimeout(resolve, 1500));
});

test('the analytics page is gone: its addresses lead into the explorer', async ({ page }) => {
	await expectRetired(page, '/harness/analytics');
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toHaveCount(
		0
	);
	await expect(page.getByRole('region', { name: 'Working agents', exact: true })).toHaveCount(0);
	await expectRetired(page, `/harness/analytics?project=${foreign}`);
	await expect(page.locator('body')).not.toContainText('Foreign agent');
});

test('the activity names the hosting repository and who is working in it on what', async ({
	request
}) => {
	const { answer, text } = await activityAnswer(request);
	expect(answer.activity.repository).toEqual({
		name: 'alpha-project',
		branch: 'main',
		head: made.commits.second
	});
	const { agents } = answer.live;
	expect([agents.tracking, agents.working]).toEqual(['available', 1]);
	const named = (label: string) => agents.roster.find((agent) => agent.label === label)!;
	expect(named('Opus session')).toMatchObject({
		state: 'working',
		provider: 'anthropic',
		model: 'claude-opus-5-5',
		worktree: 'alpha-checkout',
		branch: 'checkout',
		task: 'Cart totals',
		units: ['service.cart']
	});
	// A registration that went quiet, or ended, is said to be that and is not counted.
	expect(named('Quiet helper').state).toBe('stale');
	expect(named('Finisher').state).toBe('completed');
	expect(named('Finisher').outcome).toBe('Handed over');
	expect(agents.roster.filter((agent) => agent.state === 'working')).toHaveLength(1);
	expect(text).not.toMatch(other);
});

test('loop types, recent work and changed files are those of the repository', async ({
	request
}) => {
	const { answer } = await activityAnswer(request);
	const loops = Object.fromEntries(
		answer.activity.loops.types.map((type) => [
			type.template,
			[type.loops, type.complete, type.open]
		])
	);
	expect(loops).toEqual({ feature: [2, 1, 1], 'bug-fix': [1, 0, 1] });
	const [latest] = answer.activity.work;
	expect(latest).toMatchObject({
		commit: made.commits.second,
		subject: 'feat: triple the price',
		units: ['function.price'],
		reasons: [{ unit: 'function.price', behavior: 'Prices are tripled.' }]
	});
	const first = answer.activity.work.find((item) => item.subject === 'feat: prices and a cart')!;
	// A commit nobody explained says so by having no reason, not an invented one.
	expect([first.commit, first.reasons]).toEqual([made.commits.first, []]);
	const committed = answer.activity.files.map((file) => file.path);
	expect(committed).toContain('src/utils/price.ts');
	expect(committed).not.toContain('draft-notes.txt');
	expect(answer.activity.files.find((file) => file.path === 'src/utils/price.ts')?.units).toEqual([
		'function.price'
	]);
	// What is not committed belongs to the checkout it lies in, with what it is.
	const checkout = answer.live.worktrees.find((tree) => tree.name === 'alpha-checkout')!;
	expect(checkout.branch).toBe('checkout');
	const open = Object.fromEntries(checkout.changes.map((change) => [change.path, change]));
	expect(open['src/services/CartService.ts'].units).toEqual(['service.cart']);
	expect(open['draft-notes.txt'].status).toBe('untracked');
});

test('a history keeps the activity recorded with it, without live agents or uncommitted work', async ({
	page,
	request
}) => {
	const recorded = await (await request.get('/harness/data/activity.json')).json();
	expect(recorded.kind).toBe('recorded');
	const work = recorded.work.map((item: { commit: string }) => item.commit);
	expect(work).toContain(commits.sourceOnly);
	// Who works now and what is not committed are not part of a recorded history.
	expect(recorded.live).toBeUndefined();
	expect(JSON.stringify(recorded)).not.toMatch(/heartbeatAt|worktrees/);
	// The address of the removed activity view leads to the same commit in the explorer.
	await page.goto(`/harness/branch/main/commit/${commits.sourceOnly}/activity`);
	await expect(page).toHaveURL(
		new RegExp(`/harness/branch/main/commit/${commits.sourceOnly}/pages$`)
	);
	await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toHaveCount(0);
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`/commit/${commits.sourceOnly}/pages$`));
});

test('activity is served to the owner only and for this repository only, whatever the address asks', async ({
	request
}) => {
	const own = await activityAnswer(request);
	expect(own.response.status()).toBe(200);
	expect([own.answer.activity.repository.name, own.answer.live.agents.working]).toEqual([
		'alpha-project',
		1
	]);
	// Neither another application nor where things are on this machine leaves the server.
	expect(own.text).not.toMatch(other);
	expect(own.text).not.toContain(fixtures.root);
	const asked = await activityAnswer(
		request,
		`?project=${foreign}&site=${foreign}&root=${foreign}`
	);
	expect(asked.text).not.toMatch(other);
	expect(asked.answer.activity.repository.name).toBe('alpha-project');
	// Nothing is registered or changed over the network: the API only reads.
	expect((await request.post('/api/project-activity', { data: {} })).status()).toBe(405);
	// A server that admits no owner gives neither the addresses nor the data.
	for (const path of [
		'/api/project-activity',
		'/harness/analytics',
		'/harness/data/activity.json'
	]) {
		const refused = await request.get(locked(path), { maxRedirects: 0 });
		expect([path, refused.status()]).toEqual([path, 403]);
		expect(await refused.text()).not.toContain('alpha-project');
	}
});
