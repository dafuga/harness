import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { persistReasons, renderReasons } from '../../src/cli/program/persistReasons';
import type { PersistedReasons } from '../../src/cli/program/persistReasons.types';

const UNIT_ID = 'workflow.persist-reasons';

const RANGE_RESULT: PersistedReasons = {
	commit: '3b7e1f09c2a84d6e5f0b19a7c2d4e8f1a6b3c507',
	base: 'a91c04d7e2f6b35c8d1e0a4f9b27c6d3e5f81b20',
	attached: 2,
	missing: []
};

const EMPTY_TREE_RESULT: PersistedReasons = {
	commit: '9f2c4b1e7a3d58c60b1f2e9d4a7c83b5e0d16a42',
	base: null,
	attached: 0,
	missing: ['src/a.ts has no reason', 'src/b.ts has no reason']
};

function meta(state: string, symbol: string) {
	return {
		unitId: UNIT_ID,
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function commitEmpty(repository: { git: (...args: string[]) => string }, message: string): string {
	repository.git(
		'-c',
		'user.name=Harness Test',
		'-c',
		'user.email=harness@example.invalid',
		'commit',
		'--allow-empty',
		'-m',
		message
	);
	return repository.git('rev-parse', 'HEAD').trim();
}

test('Renders the header for a range measured from a base', () => {
	const text = renderReasons(RANGE_RESULT);

	expect(text).toBe('2 reasons for a91c04d..3b7e1f0 are kept in notes.');
	recordExampleCases(
		meta('renders-the-header-for-a-range-measured-from-a-base', 'renderReasons'),
		[{ name: 'two reasons measured from a base', input: RANGE_RESULT, output: text }]
	);
});

test('Renders an empty tree base with each missing change', () => {
	const text = renderReasons(EMPTY_TREE_RESULT);

	expect(text).toBe(
		'0 reasons for an empty tree..9f2c4b1 are kept in notes.\n' +
			'  src/a.ts has no reason\n' +
			'  src/b.ts has no reason'
	);
	recordExampleCases(meta('renders-an-empty-tree-base-with-each-missing-change', 'renderReasons'), [
		{ name: 'null base with two missing changes', input: EMPTY_TREE_RESULT, output: text }
	]);
});

test('Persists no reasons for a commit that changes nothing', async () => {
	await withTempRepo(async (repository) => {
		const parent = commitEmpty(repository, 'base');
		const head = commitEmpty(repository, 'head');

		const result = await persistReasons({ root: repository.root });

		expect(result).toEqual({ commit: head, base: parent, attached: 0, missing: [] });
		recordExampleCases(
			meta('persists-no-reasons-for-a-commit-that-changes-nothing', 'persistReasons'),
			[
				{
					name: 'empty commit on top of a base has no reasons to keep',
					input: { commit: 'HEAD' },
					output: result
				}
			]
		);
	});
});
