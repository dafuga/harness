import { expect, test } from 'vitest';
import { normalizeTrackerItemFields as normalize } from '../../../src/utils/projects-sessions/normalizeTrackerItemFields';
import { measureWorkload } from '../../support/measureWorkload';
import { clock, now } from './trackerItemFixture';

const unit = 'function.projects-sessions-normalize-tracker-item-fields';

test('normalization produces scalar journal fields and uses Lisbon for relative dates', () =>
	measureWorkload(unit, 'normalize-relative-dates-and-flags', () => {
		expect(
			normalize(
				{
					title: ' Fixture ',
					status: 'In Progress',
					due: '+2d',
					ignored_until: '2026-07-10T03:00:00+02:00',
					needs_daniel: 'false',
					deleted: '0',
					sensitive: 'yes',
					question: ' ',
					project: '',
					repo: ' ~/work/fixture ',
					owner: undefined,
					last_result: { occurrence: now, status: 'done' }
				},
				clock
			)
		).toEqual({
			title: 'Fixture',
			status: 'in_progress',
			due: '2026-07-04',
			ignored_until: '2026-07-10T01:00:00.000Z',
			needs_daniel: 0,
			deleted: 0,
			sensitive: 1,
			question: '',
			project: null,
			repo: '~/work/fixture',
			last_result: JSON.stringify({ occurrence: now, status: 'done' })
		});
	}));

test('normalization preserves recurrence syntax and caller-supplied launch identity', () => {
	expect(
		normalize(
			{
				every: '  5,50  1-9/2 * Apr,May Sun,7  ',
				every_tz: 'America/New_York',
				auto: true,
				occurrence: '2026-07-01'
			},
			clock
		)
	).toEqual({
		every: '5,50 1-9/2 * Apr,May Sun,7',
		every_tz: 'America/New_York',
		auto: 'fixture-node@2026-07-01T23:30:00.000Z#fixture-nonce',
		occurrence: '2026-07-01T00:00:00.000Z'
	});
	expect(normalize({ auto: 'kept-token', every: 'none', due: 'none' }, clock)).toEqual({
		auto: 'kept-token',
		every: null,
		due: null
	});
});

test('normalization rejects unknown fields, bad dates, cron and callback input with legacy messages', () => {
	expect(() => normalize({ foreign: 1 }, clock)).toThrow('unknown field "foreign"');
	expect(() => normalize({ kind: 'ticket' }, clock)).toThrow(
		'kind must be one of task, plan, goal, recurring'
	);
	expect(() => normalize({ status: 'paused' }, clock)).toThrow(
		'status must be open, in_progress, blocked, done or ignored'
	);
	expect(() => normalize({ title: ' ' }, clock)).toThrow('title must not be empty');
	expect(() => normalize({ due: 'next week' }, clock)).toThrow('bad due date "next week"');
	expect(() => normalize({ repo: './fixture' }, clock)).toThrow('repo must be an absolute path');
	expect(() => normalize({ callback: { url: 'ftp://example.test' } }, clock)).toThrow(
		'callback url must be http(s)'
	);
	expect(() => normalize({ every: '61 * * * *' }, clock)).toThrow('minute 61 out of range 0-59');
	expect(() => normalize({ every: '0 0 31 2 *' }, clock)).toThrow('cron "?" never fires');
	expect(() => normalize({ every_tz: 'Mars/Olympus' }, clock)).toThrow(
		'unknown time zone "Mars/Olympus"'
	);
});
