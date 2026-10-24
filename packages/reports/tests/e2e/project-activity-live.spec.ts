import { expect, test } from '../../../../test/support/browserTest';
import { activityAnswer } from './support/activityAnswer';
import { activityFixture } from './support/activityFixture';
import { expectRetired } from './support/portableReport';
import { checkpoint, expectNoOverflow, tip } from './support/explorer';
import { viewports } from './support/harnessCapture';

/**
 * The page that kept reading who is working is gone. What let it read again, show a busy
 * repository briefly and stop naming anybody once a reading was old is in every answer of the
 * activity API: when it was sampled, how long each agent counts, and how much there is beside
 * what is listed. Those are guarded here, on the real answer of the server under test.
 */
test.beforeAll(() => {
	activityFixture();
	return new Promise((resolve) => setTimeout(resolve, 1500));
});

test('the page that read activity live is gone: its address leads into the explorer', async ({
	page
}) => {
	await expectRetired(page, '/harness/analytics');
	await expect(page.getByRole('button', { name: 'Refresh activity' })).toHaveCount(0);
	await expect(page.getByTestId('agents-working')).toHaveCount(0);
});

for (const viewport of viewports) {
	test(`Agents shows live tasks and refreshes the roster at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto(tip('main', 'agents'));
		await page.waitForLoadState('networkidle');
		await checkpoint(page, `agents-${viewport.id}`);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Agents', exact: true })
		).toBeVisible();
		await expect(page.getByTestId('agents-working')).toHaveText('1');
		const roster = page.getByRole('list', { name: 'Agent roster' });
		await expect(roster.getByText('Opus session', { exact: true })).toBeVisible();
		await expect(roster.getByText('Task: Cart totals', { exact: true })).toBeVisible();
		await expect(roster.getByText('anthropic · claude-opus-5-5', { exact: true })).toBeVisible();
		await expect(roster.getByText('Stale', { exact: true })).toBeVisible();
		await expect(roster.getByText('Finished', { exact: true })).toBeVisible();
		await expect(roster.getByText('Foreign agent', { exact: true })).toHaveCount(0);
		await expect(
			page.getByText('Live activity for the running repository', { exact: false })
		).toBeVisible();
		const renewed = page.waitForResponse((response) =>
			response.url().endsWith('/api/project-activity')
		);
		await page.getByRole('button', { name: 'Refresh activity' }).click();
		expect((await renewed).ok()).toBe(true);
		await expect(page.getByTestId('agents-working')).toHaveText('1');
		await expectNoOverflow(page);
		await page
			.getByRole('navigation', { name: 'Harness categories' })
			.getByRole('link', { name: 'Pages', exact: true })
			.click();
		await expect(page.getByRole('heading', { level: 1, name: 'Pages', exact: true })).toBeVisible();
		await page.getByRole('link', { name: 'Agents', exact: true }).click();
		await expect(page.getByTestId('agents-working')).toHaveText('1');
	});
}

test('a reading says when it was taken and is taken anew on every request', async ({ request }) => {
	const first = await activityAnswer(request);
	expect(first.response.headers()['cache-control']).toBe('no-store');
	const taken = Date.parse(first.answer.live.sampledAt);
	expect(Math.abs(Date.now() - taken)).toBeLessThan(60_000);
	await new Promise((resolve) => setTimeout(resolve, 20));
	const second = await activityAnswer(request);
	expect(Date.parse(second.answer.live.sampledAt)).toBeGreaterThan(taken);
});

test('an agent counts only until the time it states, and a quiet one is not working', async ({
	request
}) => {
	const { answer } = await activityAnswer(request);
	const { roster, working } = answer.live.agents;
	const sampled = Date.parse(answer.live.sampledAt);
	for (const agent of roster.filter((item) => item.state === 'working')) {
		// A reader that stops hearing from the server knows when to stop naming this agent.
		expect(Date.parse(agent.expiresAt)).toBeGreaterThan(Date.parse(agent.heartbeatAt));
		expect(Date.parse(agent.expiresAt)).toBeGreaterThan(sampled);
	}
	const quiet = roster.find((agent) => agent.label === 'Quiet helper')!;
	expect(quiet.state).toBe('stale');
	expect(Date.parse(quiet.expiresAt)).toBeLessThan(sampled);
	expect(working).toBe(roster.filter((agent) => agent.state === 'working').length);
});

test('a busy repository can be shown briefly: each list says how much there is beside it', async ({
	request
}) => {
	const { answer } = await activityAnswer(request);
	for (const item of answer.activity.work) {
		expect(item.unitCount).toBeGreaterThanOrEqual(item.units.length);
		expect(item.reasonCount).toBeGreaterThanOrEqual(item.reasons.length);
		expect(item.files).toBeGreaterThan(0);
	}
	for (const tree of answer.live.worktrees) {
		expect(typeof tree.truncated).toBe('boolean');
	}
	expect(answer.activity.loops.total).toBe(
		answer.activity.loops.types.reduce((sum, type) => sum + type.loops, 0)
	);
});

test('the CPU sample says which figures are the machine and which are this repository', async ({
	request
}) => {
	const sample = await (await request.get('/api/analytics-cpu')).json();
	expect(sample.status).toBe('available');
	// The machine as a whole is one figure; what Harness and its agents use are others.
	expect(sample.machinePercent).toBeGreaterThanOrEqual(0);
	const groups = Object.fromEntries(
		sample.groups.map((group: { id: string; label: string }) => [group.id, group.label])
	);
	expect(groups).toEqual({ codex: 'Codex app', harness: 'Harness', agents: 'Local agents' });
	const tracked = sample.groups.reduce(
		(sum: number, group: { machinePercent: number }) => sum + group.machinePercent,
		0
	);
	expect(Math.abs(tracked - sample.trackedPercent)).toBeLessThan(0.5);
});
