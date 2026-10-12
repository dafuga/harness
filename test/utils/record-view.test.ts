import { expect, test } from 'vitest';
import { recordView } from '../../src/utils/recordView';
import { verificationSample } from '../support/verificationSample';

const resolve = () => ({ media: null, gap: 'not resolved' });
const commit = 'b'.repeat(40);

/** A record whose one scenario was not run again: it refers to the record that ran it. */
function referring() {
	const referenced = {
		id: 'titles-page',
		status: 'referenced' as const,
		testedRevision: commit,
		referencedRecord: 'origin-record',
		states: []
	};
	return { ...verificationSample(), scenarios: [referenced] };
}
const ranHere = () => ({
	...verificationSample(),
	scenarios: [{ id: 'titles-page', status: 'passed' as const, testedRevision: commit, states: [] }]
});

test('an inherited scenario carries the checks its origin ran, by their scoped names', () => {
	const record = referring();
	const id = record.scenarios[0].id;
	const ran = [
		{ id: `${id}:page`, status: 'passed' },
		{ id: 'another-scenario:page', status: 'failed' },
		{ id: 'test/unit/a.test.ts', status: 'passed' }
	];
	const view = recordView(record, {
		valid: true,
		problems: [],
		resolve,
		origins: (origin) => (origin === 'origin-record' ? ran : undefined)
	});
	expect(view.scenarios[0]).toMatchObject({
		inherited: true,
		origin: { record: 'origin-record', commit },
		originTests: [{ id: `${id}:page`, status: 'passed' }]
	});
});

test('an origin that cannot be read leaves its checks unstated, and a fresh scenario has none', () => {
	const unread = recordView(referring(), {
		valid: true,
		problems: [],
		resolve,
		origins: () => undefined
	});
	expect('originTests' in unread.scenarios[0]).toBe(false);
	const older = recordView(referring(), { valid: true, problems: [], resolve });
	expect('originTests' in older.scenarios[0]).toBe(false);
	const fresh = recordView(ranHere(), {
		valid: true,
		problems: [],
		resolve,
		origins: () => []
	});
	expect(fresh.scenarios).toHaveLength(1);
	expect(fresh.scenarios.every((scenario) => !('originTests' in scenario))).toBe(true);
});
