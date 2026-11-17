import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { renderRoster, renderShown, showActivity } from '../../src/workflows/projects-sessions/runActivity';
import type { Shown } from '../../src/workflows/projects-sessions/runActivity.types';

const roster = {
	tracking: 'available' as const,
	working: 1,
	unreadable: 0,
	roster: [
		{
			id: 'reviewer-evidence',
			label: 'Reviewer',
			provider: 'anthropic',
			model: 'claude-sonnet-5-5',
			worktree: 'example-worktree',
			branch: 'feature/activity-roster',
			task: 'Writing the evidence grid tests',
			loop: 'sol-12-cli-startup',
			units: ['reports.component.evidence-grid'],
			unknownUnits: [],
			registeredAt: '2026-11-15T08:57:03.114Z',
			heartbeatAt: '2026-11-15T09:12:44.318Z',
			expiresAt: '2026-11-15T09:22:44.318Z',
			state: 'working' as const,
			detail: 'Last heartbeat at 2026-11-15T09:12:44.318Z'
		}
	]
};

const shown: Shown = {
	activity: {
		schemaVersion: 1,
		kind: 'live',
		repository: { name: 'harness', branch: 'main', head: '3f9a1c7e5b2d84f60a1c9e3d7b5f2a08c4e61d9b' },
		asOf: null,
		loops: {
			total: 1,
			types: [{ template: 'regression-prevention', loops: 1, complete: 0, open: 1, lastUsedAt: '2026-11-02T00:17:26.223Z', names: ['sol-12-cli-startup'] }]
		},
		work: [{ commit: '3f9a1c7e5b2d84f60a1c9e3d7b5f2a08c4e61d9b', subject: 'Show agents in the activity roster', author: 'Sam Rivera', committedAt: '2026-11-14T16:22:08+01:00', branches: ['main'], units: ['workflow.run-activity'], unitCount: 1, reasons: [], reasonCount: 0, files: 1 }],
		files: []
	},
	live: {
		sampledAt: '2026-11-15T09:12:45.002Z',
		worktrees: [{ name: 'harness', branch: 'main', head: null, primary: true, changes: [{ path: 'src/workflows/projects-sessions/runActivity.ts', status: 'modified', units: ['workflow.run-activity'] }], truncated: false }],
		agents: roster
	}
};

test('Renders registered agents and an unused roster', () => {
	const working = renderRoster(roster);
	const unused = renderRoster({ tracking: 'never-used', working: null, unreadable: 0, roster: [] });
	expect(working).toContain('Reviewer');
	expect(unused).toContain('No agent has registered');
	recordExampleCases(
		{ unitId: 'workflow.run-activity', symbol: 'renderRoster', state: 'renders-registered-agents-and-an-unused-roster', evidence: 'examples-cases', file: 'renders-registered-agents-and-an-unused-roster.json' },
		[
			{ name: 'working reviewer', input: roster, output: working },
			{ name: 'repository with no registrations', input: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }, output: unused }
		]
	);
});

test('Renders repository activity and live checkout changes', () => {
	const output = renderShown(shown);
	expect(output).toContain('harness · branch main · 3f9a1c7');
	expect(output).toContain('harness (main): 1 uncommitted');
	recordExampleCases(
		{ unitId: 'workflow.run-activity', symbol: 'renderShown', state: 'renders-repository-activity-and-live-checkout-changes', evidence: 'examples-cases', file: 'renders-repository-activity-and-live-checkout-changes.json' },
		[{ name: 'repository with one recent change and registered reviewer', input: shown, output }]
	);
});

test('Throws ExpectedCliError for an invalid activity limit', async () => {
	let caught: unknown;
	try {
		await showActivity({ limit: '0' });
	} catch (error) {
		caught = error;
	}
	const detail = caught instanceof Error ? { name: caught.name, message: caught.message } : null;
	expect(detail).toMatchObject({ name: 'ExpectedCliError', message: '--limit must be a whole number from 1 to 200.' });
	recordExampleCases(
		{ unitId: 'workflow.run-activity', symbol: 'showActivity', state: 'throws-expectedclierror-for-an-invalid-activity-limit', evidence: 'examples-cases', file: 'throws-expectedclierror-for-an-invalid-activity-limit.json' },
		[{ name: 'zero activity limit', input: { limit: '0' }, error: detail }]
	);
});
