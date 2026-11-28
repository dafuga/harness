import { expect, afterEach, beforeEach, onTestFinished, test, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { verifyArtifactCommand } from '../../support/trackerPlanningAssertions';
import { createTempDirectory } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import { TrackerCommand } from '../../../src/commands/projects-sessions/TrackerCommand';
import { formatNativeTrackerRunRead } from '../../../src/commands/projects-sessions/tracker-command/formatNativeTrackerItem';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

import {
	compatibilityFixture,
	fixtureTime,
	fixtureItem,
	fixtureTitle,
	verifyNativeLaunchReceipts,
	verifyTrackerReminderScheduling
} from '../../support/trackerCliCompatibilityFixture';

beforeEach(async () => {
	const configHome = await createTempDirectory('tracker-cli-config-');
	onTestFinished(() => rmSync(configHome, { recursive: true, force: true }));
	vi.stubEnv('HARNESS_TRACKER_CONFIG', undefined);
	vi.stubEnv('XDG_CONFIG_HOME', configHome);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

test('Tracker reports a missing retained client', () => {
	vi.stubEnv('HARNESS_TRACKER_FORWARD_PARENT', '');
	vi.stubEnv('HARNESS_TRACKER_LEGACY_BIN', '/dev/null/tracker');
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(new TrackerCommand().run(['status'])).toBe(126);
	expect(error).toHaveBeenCalledWith(expect.stringContaining('could not start the legacy client'));
});

test('Tracker rejects a shim that points back at Harness', () => {
	vi.stubEnv('HARNESS_TRACKER_FORWARD_PARENT', String(process.ppid));
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(new TrackerCommand().run(['status'])).toBe(126);
	expect(error).toHaveBeenCalledWith('tracker: the shim needs a retained legacy client.');
});

test('native Tracker forwards existing run, report and model selection commands', () =>
	measureWorkload('command.projects-sessions-tracker', 'run-report-cli', async () => {
		expect(
			nativeTrackerArgs(['runs', '--item', 'abc123', '--limit', '4', '--json']).request
		).toEqual({
			method: 'GET',
			path: '/runs?item=abc123&limit=4'
		});
		expect(nativeTrackerArgs(['models', 'report']).request).toEqual({
			method: 'GET',
			path: '/models/report'
		});
		expect(nativeTrackerArgs(['pick', 'abc123']).request).toEqual({
			method: 'GET',
			path: '/items/abc123/pick'
		});
		expect(() => nativeTrackerArgs(['models', 'delete'])).toThrow('usage: tracker models report');
		expect(formatNativeTrackerRunRead('runs', [])).toBe('(no runs)');
		expect(formatNativeTrackerRunRead('models', { ladder: ['sol'], rows: [] })).toBe(
			'(no finished runs yet)'
		);
		expect(
			formatNativeTrackerRunRead('pick', {
				rung: 'sol',
				model: 'gpt-6.2-sol',
				effort: 'medium',
				cli: 'codex',
				pinned: true,
				reason: 'named on the item',
				computer: 'fixture-mac'
			})
		).toBe(
			'sol (gpt-6.2-sol medium, codex) - named on the item\n  named on the item\n  computer: fixture-mac'
		);
		await verifyCodexReportRange();
	}));

async function verifyCodexReportRange() {
	const fixture = await compatibilityFixture();
	const { database, run } = fixture;
	database
		.prepare(
			`INSERT INTO runs (item_id, model, rung, cli, state, outcome, queued_at,
			input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
		VALUES (?, 'gpt-6.2-sol', 'sol', 'codex', 'finished', 'done', ?, 300000, 10000, 100000, 0)`
		)
		.run(fixtureItem, Date.parse(fixtureTime));
	const { code, out } = await run('models', 'report');
	expect(code).toBe(0);
	expect(out).toContain('$0.71–$1.37');
	expect(out).toContain('1/1');
	expect(out).toContain('API-equivalent estimate');
	await verifyNativeLaunchReceipts(fixture);
}

test('native show prints the full human item and returns the enriched JSON for a prefix', async () => {
	const { database, runtime, run } = await compatibilityFixture();
	runtime.store.appendLocal({ itemId: fixtureItem, fields: { notes: 'Fixture details' } });
	database
		.prepare(
			"INSERT INTO runs (item_id, model, rung, cli, state, outcome, queued_at, started_at) VALUES (?, ?, 'sol', 'codex', 'finished', 'done', ?, ?)"
		)
		.run(fixtureItem, 'fixture-model', Date.parse(fixtureTime), Date.parse(fixtureTime));
	const human = await run('show', 'taskfi');
	expect(human).toMatchObject({ code: 0, err: '' });
	expect(human.out.split('\n')).toEqual(
		expect.arrayContaining([
			`  id: ${fixtureItem}`,
			'  notes: Fixture details',
			'  due scheduler: would launch on daniel-primary-mbp (claude-haiku-5-5:high)',
			expect.stringContaining('run #1 [taskfi]')
		])
	);
	const json = await run('show', 'taskfi', '--json');
	expect(JSON.parse(json.out)).toMatchObject({
		id: fixtureItem,
		notes: 'Fixture details',
		schedule_preview: 'would launch on daniel-primary-mbp (claude-haiku-5-5:high)',
		runs: [{ id: 1, model: 'fixture-model', outcome: 'done' }],
		launch_status: null
	});
	await verifyArtifactCommand(run);
	vi.stubEnv('TRACKER_RUN_ID', '42');
	const started = await run('start', 'taskfi', '--json');
	expect(started.code).toBe(0);
	expect(JSON.parse(started.out)).toMatchObject({ id: fixtureItem, status: 'in_progress' });
	expect((vi.mocked(fetch).mock.lastCall?.[1] as RequestInit).body).toBe(
		JSON.stringify({ session_run: '42' })
	);
	expect(await run('show', 'absent')).toMatchObject({
		code: 1,
		out: '',
		err: 'tracker: no item "absent"'
	});
});

test('native remind holds delivery and keeps the ask visible in the digest', async () => {
	const { runtime, run } = await compatibilityFixture();
	runtime.store.appendLocal({
		itemId: fixtureItem,
		actor: 'Chief of Staff',
		fields: { status: 'blocked', needs_daniel: 1, question: 'Approve the fixture?' }
	});
	const at = await verifyTrackerReminderScheduling(run);
	expect(JSON.parse((await run('list', '--flagged', '--json')).out)).toEqual([]);
	expect(JSON.parse((await run('digest', '--json')).out)).toMatchObject({
		blocked: [],
		needs_daniel: [{ id: 'taskfixture', remind_at: at, waiting_minutes: 0 }]
	});
	expect(JSON.parse((await run('list', '--status', 'all', '--json')).out)).toEqual(
		expect.arrayContaining([expect.objectContaining({ id: fixtureItem, remind_at: at })])
	);
	const answered = await run('answer', 'taskfi', 'Approved', '--json');
	expect(JSON.parse(answered.out)).toMatchObject({
		id: fixtureItem,
		resolved: true,
		remind_at: null
	});
});

test('native ignore and unignore restore item state and record the legacy actor and notes', async () => {
	const { runtime, route, run } = await compatibilityFixture();
	runtime.store.appendLocal({
		itemId: fixtureItem,
		actor: 'Chief of Staff',
		fields: { status: 'in_progress', needs_daniel: 1 }
	});
	const invalid = await run('ignore', 'taskfi');
	expect(invalid).toEqual({
		code: 1,
		out: '',
		err: 'tracker: usage: tracker ignore <id> --reason "<why>" [--until DATE] [--by NAME]'
	});
	expect(route).not.toHaveBeenCalled();
	const ignored = await run(
		'ignore',
		'taskfi',
		'duplicate',
		'work',
		'--until',
		'tomorrow',
		'--by',
		'Fixture Reviewer'
	);
	expect(ignored).toMatchObject({ code: 0, err: '' });
	expect(ignored.out).toContain(
		'ignored: [taskfi] Verify fixture CLI release  (IGNORED: duplicate work (until 2026-11-22)'
	);
	expect(await run('ignore', 'taskfi', '--reason', 'again')).toMatchObject({
		code: 1,
		err: 'tracker: item taskfi is already ignored'
	});
	expect(await run('check', fixtureTitle, '--json')).toMatchObject({ code: 4 });
	const restored = await run('unignore', 'taskfi', '--note', 'revisit', '--json');
	expect(restored).toMatchObject({ code: 0, err: '' });
	expect(JSON.parse(restored.out)).toMatchObject({
		status: 'in_progress',
		needs_daniel: true,
		notes_log: [
			{ text: 'ignored by Fixture Reviewer: duplicate work; until 2026-11-22' },
			{ text: 'unignored by fixture-default: revisit; back to in_progress' }
		]
	});
	expect(
		runtime.store
			.opsSince(0, 10)
			.slice(-2)
			.map(({ actor }) => actor)
	).toEqual(['Fixture Reviewer', 'fixture-default']);
	expect(await run('unignore', 'taskfi')).toMatchObject({
		code: 1,
		err: 'tracker: item taskfi is not ignored (status in_progress)'
	});
});
