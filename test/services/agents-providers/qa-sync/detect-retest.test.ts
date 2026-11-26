import { describe, expect, test } from 'vitest';
import { detectRetest } from '../../../../src/services/agents-providers/qa-sync-service/detectRetest';

const retest = {
	label: 'needs testing on {environment}',
	environments: { staging: ['staging'], production: ['production', 'prod'] },
	defaultEnvironment: 'staging',
	requesters: []
};

describe('detectRetest', () => {
	test.each([
		['Retest please', ['staging']],
		['retest: logo upload', ['staging']],
		['Please re-test this on production', ['production']],
		['Can you test it again?', ['staging']],
		['Fix is on staging. Ready for retest.', ['staging']],
		['Deployed to prod. Ready to test', ['production']],
		['This needs testing on staging and prod', ['staging', 'production']],
		['Not fixed on prod, but please retest on staging', ['staging']]
	])('%s', (text, expected) => {
		expect(detectRetest(text, retest)).toEqual(expected);
	});

	test.each([
		'No need to retest this',
		"It's not ready for testing yet",
		'This doesn’t need testing',
		'I retested and step 3 still fails',
		'I will retest tomorrow',
		'> Ready for retest\nstill broken',
		'The label says `ready for retest`',
		'React ✅ if the checks pass. If something fails, react ❌.',
		'GitHub retest instructions: <https://github.com/acme/app/issues/5>'
	])('ignores: %s', (text) => {
		expect(detectRetest(text, retest)).toEqual([]);
	});
});
