import { afterEach, expect, test, vi } from 'vitest';
import {
	compatibilityFixture,
	fixtureTime,
	fixtureTitle
} from '../../support/trackerCliCompatibilityFixture';
import { measureWorkload } from '../../support/measureWorkload';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

test('block accepts --no-needs-daniel and points --needs-daniel at flag', async () => {
	const { run } = await compatibilityFixture();
	const refused = await run('block', 'taskfi', 'waiting on CI', '--needs-daniel');
	expect(refused).toMatchObject({ code: 1, err: expect.stringContaining('tracker flag') });
	expect(JSON.parse((await run('show', 'taskfi', '--json')).out)).toMatchObject({
		status: 'open'
	});
	const blocked = await run('block', 'taskfi', 'waiting on CI', '--no-needs-daniel', '--json');
	expect(blocked).toMatchObject({ code: 0, err: '' });
	expect(JSON.parse(blocked.out)).toMatchObject({
		status: 'blocked',
		blocked_reason: 'waiting on CI',
		needs_daniel: false
	});
});

test('add prints the model pick and how to launch a task', () =>
	measureWorkload('command.projects-sessions-tracker', 'add-model-pick-cli', async () => {
		const { run } = await compatibilityFixture();
		const added = await run('add', 'Rename the zebra enclosure label');
		expect(added).toMatchObject({ code: 0, err: '' });
		expect(added.out).toMatch(
			/^added \[\w{6}\] Rename the zebra.*\n {2}model: \S+ \(.+\) - .+\n {2}to have the tracker run it on the right computer: tracker launch \w{6}$/
		);
		for (const args of [
			['add', 'Paint the walrus gate', '--quiet'],
			['plan', 'Quarterly otter habitat survey']
		]) {
			expect((await run(...args)).out).not.toContain('model:');
		}
		const json = await run('add', 'Order penguin feeding buckets', '--json');
		expect(JSON.parse(json.out)).toMatchObject({ title: 'Order penguin feeding buckets' });
	}));

test('add still succeeds when the model pick cannot be read', async () => {
	const { run, route } = await compatibilityFixture();
	const serve = route.getMockImplementation()!;
	route.mockImplementation(async (url, init) => {
		if (url.endsWith('/pick')) throw new Error('fixture pick unavailable');
		return serve(url, init);
	});
	const added = await run('add', 'Repair the flamingo pond pump');
	expect(added).toMatchObject({ code: 0, err: '' });
	expect(added.out).toMatch(/^added \[\w{6}\] Repair the flamingo pond pump.*$/);
});

test('adds a versioned session rule to the incident and lists it without a restart', () =>
	measureWorkload('command.projects-sessions-tracker', 'append-session-rule-cli', async () => {
		const { run, runtime } = await compatibilityFixture();
		const text = 'Keep the fixture report in its assigned directory.';
		const add = () =>
			run('rule', 'add', text, '--from', 'taskfi', '--skill', 'computer-hygiene', '--json');
		expect(JSON.parse((await run('rule', 'list', '--json')).out)).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ text })])
		);
		const added = await add();
		expect(added).toMatchObject({ code: 0, err: '' });
		const rule = JSON.parse(added.out);
		expect(rule).toMatchObject({
			text,
			skill: 'computer-hygiene',
			incident: 'taskfixture',
			at: fixtureTime
		});
		expect(JSON.parse((await add()).out)).toEqual(rule);
		expect(JSON.parse((await run('rule', 'list', '--json')).out)).toContainEqual(rule);
		expect(JSON.parse((await run('show', 'taskfi', '--json')).out).notes_log).toEqual([
			expect.objectContaining({ text: expect.stringContaining(text) })
		]);
		const invalid = await run(
			'rule',
			'add',
			'A rule.',
			'--from',
			'taskfi',
			'--skill',
			'../elsewhere'
		);
		expect(invalid.code).toBe(1);
		const missing = await run(
			'rule',
			'add',
			'Another rule.',
			'--from',
			'absent',
			'--skill',
			'computer-hygiene'
		);
		expect(missing.code).toBe(1);
		expect(
			runtime.store
				.opsSince(0, 100)
				.filter(({ fields }) => Object.hasOwn(fields, 'session_rule_v1'))
		).toHaveLength(1);
	}));

test('history prints one line for each occurrence unless JSON is asked for', async () => {
	const { run, route } = await compatibilityFixture();
	const rows = [
		{
			occurrence: '2026-11-21T09:00:00.000Z',
			status: 'ok',
			fired_at: null,
			result_at: '2026-11-21T09:05:00.000Z',
			by: 'fixture-bot',
			note: 'checked'
		},
		{
			occurrence: '2026-11-20T09:00:00.000Z',
			status: 'missed',
			fired_at: null,
			result_at: null,
			by: null,
			note: null
		}
	];
	route.mockResolvedValueOnce(Response.json(rows));
	expect((await run('history', 'taskfi')).out).toBe(
		'2026-11-21T09:00:00.000Z  ok  (2026-11-21T09:05:00.000Z by fixture-bot)  checked\n' +
			'2026-11-20T09:00:00.000Z  missed'
	);
	route.mockResolvedValueOnce(Response.json([]));
	expect((await run('history', 'taskfi')).out).toBe('(no occurrences yet)');
	route.mockResolvedValueOnce(Response.json(rows));
	expect(JSON.parse((await run('history', 'taskfi', '--json')).out)).toEqual(rows);
});

test('check and a refused duplicate explain each match and what to do', async () => {
	const { run, runtime } = await compatibilityFixture();
	const open = await run('check', fixtureTitle);
	expect(open.code).toBe(5);
	expect(open.out.split('\n')).toEqual([
		'a similar item is already open:',
		`  [taskfi] ${fixtureTitle}  (open)`,
		'  Add to it instead: tracker note taskfi "..."  (or pass --force if this is genuinely separate)'
	]);
	const refused = await run('add', fixtureTitle);
	expect(refused.code).toBe(5);
	expect(refused.err).toContain('tracker: not done - a similar item is already open:');
	expect(refused.err).toContain('Add to it instead: tracker note taskfi');
	runtime.store.appendLocal({
		itemId: 'taskfixture',
		fields: {
			status: 'ignored',
			agent: 'harness',
			ignored_reason: 'not worth it',
			ignored_by: 'Daniel',
			ignored_at: '2026-11-20T08:00:00.000Z',
			ignored_until: '2026-12-01'
		}
	});
	const ignored = await run('check', fixtureTitle);
	expect(ignored.code).toBe(4);
	expect(ignored.out.split('\n')).toEqual([
		'already reported, and Daniel decided to IGNORE it:',
		`  [taskfi] ${fixtureTitle} (agent harness)`,
		'      ignored 2026-11-20 by Daniel: not worth it (until 2026-12-01)',
		'  Do not report it again. Use --force only if this is genuinely a different problem.'
	]);
	const again = await run('add', fixtureTitle);
	expect(again.code).toBe(4);
	expect(again.err).toContain('tracker: not done - already reported');
	expect((await run('check', 'unrelated giraffe ladder')).out).toBe(
		'no similar items (not ignored, not already open)'
	);
});
