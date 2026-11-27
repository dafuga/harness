import { expect, test } from 'vitest';
import { formatTrackerHostBrief } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostBrief';
import { managedBrief } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedWorkerProcess';
import { trackerComputerHygieneRule } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerComputerHygieneRule';
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
	expect(brief).toContain(trackerComputerHygieneRule);
	expect(brief).toContain('## Asking Daniel');
	expect(brief).toContain('--option "<label>=<what happens if chosen>"');
	expect(brief).toContain('--recommend');
	expect(brief).toContain('--confirm deploy|money|secret');
	expect(brief).toContain('plain English');
	expect(brief).toContain('what you want to do and why in one sentence');
	expect(brief).toContain('tool or process questions to Chief of Staff');
	expect(brief.indexOf('## Secret-safe computer use')).toBeLessThan(brief.indexOf('## Asking'));
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
		const brief = formatTrackerHostBrief(item, completion, { recovery });
		expect(brief).toContain('reread every note with `tracker show <id> --json`');
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
		expect(brief.split(trackerComputerHygieneRule)).toHaveLength(2);
		expect(brief).toContain('Read the full task with `tracker show abcdef1234567890`.');
		expect(brief).not.toContain('�');
		expect(Buffer.byteLength(brief)).toBeLessThanOrEqual(15_900);
	}
});
