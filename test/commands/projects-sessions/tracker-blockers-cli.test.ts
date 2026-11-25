import { expect, test } from 'vitest';
import { formatNativeTrackerBlockers } from '../../../src/commands/projects-sessions/tracker-command/formatNativeTrackerBlockers';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

test('tracker blockers reads the inbox, and --sync applies the escalation and recheck rules', () => {
	expect(nativeTrackerArgs(['blockers', '--json']).request).toEqual({
		method: 'GET',
		path: '/blockers'
	});
	expect(nativeTrackerArgs(['blockers', '--sync']).request).toEqual({
		method: 'POST',
		path: '/blockers/sync'
	});
});

test('the inbox text groups by type with the exact action, route and age', () => {
	const text = formatNativeTrackerBlockers({
		generated_at: '2026-11-25T12:00:00.000Z',
		total: 1,
		unescalated: 1,
		stale: 1,
		groups: [
			{
				type: 'credential_access',
				label: 'Credential / access',
				items: [
					{
						id: 'a827dmmara',
						title: 'Slack QA assistant',
						kind: 'block',
						type: 'credential_access',
						label: 'Credential / access',
						route: 'needs_daniel',
						route_to: 'Daniel',
						owner: 'BuildFlexity: Slack QA',
						agent: 'buildflexity',
						parent: null,
						action: 'GitHub credential with Issues write is absent',
						since: '2026-11-24T08:00:00.000Z',
						age_minutes: 1680,
						escalated: false,
						needs_escalation: true,
						stale: true,
						chased_at: null,
						waits_on: null,
						dependency_status: null,
						recheck: 'no change for 28h; owner re-verify the blocker or unblock',
						duplicates: ['blk002']
					}
				]
			}
		]
	});
	expect(text).toBe(
		[
			'Blockers: 1 (1 not yet on Needs Daniel, 1 stale)',
			'CREDENTIAL / ACCESS (1)',
			'  - [a827dm] Slack QA assistant - GitHub credential with Issues write is absent',
			'      28h · route needs_daniel -> Daniel · owner BuildFlexity: Slack QA · NOT ON NEEDS DANIEL · +1 duplicate',
			'      recheck: no change for 28h; owner re-verify the blocker or unblock'
		].join('\n')
	);
});
