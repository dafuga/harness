import { expect, test } from 'vitest';
import { formatTrackerHostBrief } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostBrief';
import { managedBrief } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedWorkerProcess';
import { trackerDoneProofRule } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerDoneProofRule';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';

const item = {
	id: 'abcdef1234567890',
	title: 'Synthetic task',
	notes: 'Do the synthetic work.',
	notes_log: [],
	sensitive: false
} as unknown as TrackerItem;

test('every session brief tells the agent to flag with 2 to 4 options and one recommendation', () => {
	const brief = formatTrackerHostBrief(item, 'Finish by running tracker done.');
	expect(brief).toContain('## Asking Daniel');
	expect(brief).toContain('--option "<label>=<what happens if chosen>"');
	expect(brief).toContain('--recommend');
	expect(brief).toContain('--confirm deploy|money|secret');
	expect(brief).toContain('plain English');
	expect(brief).toContain('what you want to do and why in one sentence');
	expect(brief).toContain('tool or process questions to Chief of Staff');
	expect(brief.indexOf('## Secret-safe computer use')).toBeLessThan(brief.indexOf('## Asking'));
	expect(brief).not.toContain('bun run check --item');
	expect(brief).toContain('Run only the tests relevant to your change');
	expect(brief).toContain('Reuse GitHub CI results when available');
	expect(brief).toContain('once per combined release');
	expect(brief).toContain('focused unit and E2E tests for changed modules and their dependents');
	expect(brief).toContain('typecheck and lint the changed files');
	expect(brief).toContain('deliver a screen recording of the real app');
	expect(brief).toContain('list the timestamp of each extracted frame');
	const harness = formatTrackerHostBrief(
		{ ...item, agent: 'harness' },
		'Finish by running tracker done.'
	);
	expect(harness).toContain('bun run check --item abcdef');
	expect(harness).toContain('host queue with `--release` for the combined release');
});

test('every session brief points browser work at the automation Chrome, not the main profile', () => {
	const brief = formatTrackerHostBrief(item, 'Finish by running tracker done.');
	expect(brief).toContain('http://127.0.0.1:9333');
	expect(brief).toContain('Do not turn on or ask for remote debugging');
	expect(brief).toContain('~/.local/bin/automation-signin request github');
	expect(brief.indexOf('## Asking Daniel')).toBeLessThan(brief.indexOf('## Automation Chrome'));
});

test('every session brief requires per-requirement, per-computer proof before tracker done', () => {
	const completion = '## Completion and worktree cleanup\nRun tracker done.';
	for (const recovery of [false, true]) {
		const brief = formatTrackerHostBrief(
			{ ...item, title: 'Review database migration' },
			completion,
			{ recovery }
		);
		expect(brief).toContain('Never merge into a Greymass repository');
		expect(brief).toContain('standing authorization for Harness PRs');
		expect(brief).toMatch(/production.{0,100}explicit approval/i);
		expect(brief).toMatch(/database change.*approval before.*irreversible/i);
		expect(brief).toContain('tracker check "<topic>"');
		expect(brief).toMatch(/ignored.{0,80}do not raise/i);
		expect(brief).toMatch(/update.*tests.*run them/i);
		expect(brief).toContain('reread every note, one bounded page at a time');
		expect(brief).toContain('`tracker show <id> --notes-page 1`');
		expect(brief).toContain('including appended ones) to evidence for each named computer');
		expect(brief).toContain('wait out any grace period');
		expect(brief).toContain('unproven, unseen or not rolled out, do not run `tracker done`');
		expect(brief).toContain('`siblings` and `verify` steps as complete');
		expect(brief.indexOf(completion)).toBeLessThan(brief.indexOf('## Done proof'));
	}
});

test('every session brief rejects substitutes for live proof and partial releases', () => {
	for (const recovery of [false, true]) {
		const brief = formatTrackerHostBrief(item, 'Finish by running tracker done.', { recovery });
		expect(brief).toContain('A mocked route, a direct call that skips a hop');
		expect(brief).toContain('a setting the installed app lacks is not proof of a live path');
		expect(brief).toContain('name any such substitute');
		expect(brief).toContain("every component in Daniel's approval wording and the brief");
		expect(brief).toContain('including iPhone');
		expect(brief).toContain('reads back each installed version');
		expect(brief).toContain('a required live check is `not seen`');
		expect(brief).toContain('stays open or blocked');
	}
});

test('a truncated Docker brief keeps the done proof rule within its 15,900 byte budget', () => {
	// The dispatcher's real completion section is about this long.
	const completion = `## Completion and worktree cleanup\n${'Run tracker done. '.repeat(30)}`;
	// Shifting the text a byte at a time makes the cut land inside a three-byte character.
	for (const shift of ['', 'a', 'aa']) {
		const long = { ...item, notes: shift + '€'.repeat(20000) };
		const brief = managedBrief({
			backend: 'docker',
			itemId: item.id,
			brief: formatTrackerHostBrief(long, completion)
		} as Parameters<typeof managedBrief>[0]);
		expect(brief).toContain(trackerDoneProofRule);
		expect(brief).toContain('use the `mock-mode` skill');
		expect(brief).toContain('make “Mock mode first” a task before feature work');
		expect(brief).toContain('an automated test proving zero paid calls in mock mode');
		expect(brief).toContain('Run only the tests relevant to your change');
		expect(brief).toContain('Never merge into a Greymass repository');
		expect(brief).toContain('Read the full task with `tracker show abcdef1234567890`.');
		expect(brief).not.toContain('�');
		expect(Buffer.byteLength(brief)).toBeLessThanOrEqual(15_900);
	}
});

test('a brief for a long-running item stays small and never sends a session to the full JSON', () => {
	const note = (text: string, index: number) => ({
		at: new Date(Date.UTC(2026, 10, 28, 0, index)).toISOString(),
		node: 'fixture',
		text
	});
	const handoff =
		'stopped: watchdog context handoff; resume from: handoff-marker ' + 'h'.repeat(900);
	const texts = [
		...Array.from({ length: 30 }, (_, index) => `milestone-${index + 100} ` + 'x'.repeat(2000)),
		'newest-requirement: also verify the second computer',
		handoff,
		'watchdog context: routine-marker',
		'Closed finished run session routine-marker'
	];
	const brief = formatTrackerHostBrief({ ...item, notes_log: texts.map(note) }, 'Finish.', {
		recovery: true
	});
	const recent = brief.split('## Recent notes')[1].split('## Last handoff')[0];
	expect(recent.length).toBeLessThan(6_500);
	expect(recent).toContain('newest-requirement');
	expect(recent).toContain('milestone-129');
	expect(recent).toContain('x…');
	expect(recent).toContain('tracker show abcdef --notes-page 1');
	expect(brief).not.toContain('routine-marker');
	expect(brief.split('handoff-marker')).toHaveLength(2);
	expect(brief).toContain('## Keep context small');
	expect(brief).not.toMatch(/tracker show \S+ --json/);
	const fresh = formatTrackerHostBrief({ ...item, notes_log: texts.map(note) }, 'Finish.');
	expect(fresh.split('handoff-marker')).toHaveLength(2);
	const short = formatTrackerHostBrief({ ...item, notes_log: [note('only note', 0)] }, 'Finish.');
	expect(short).toContain('only note');
	expect(short).not.toContain('earlier notes');
});
