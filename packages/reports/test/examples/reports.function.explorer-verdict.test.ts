import { test } from 'vitest';
import { explorerVerdict } from '../../src/utils/explorer-verdict/explorerVerdict';
import {
	capture,
	complete,
	declared,
	impacted,
	record,
	result,
	revision,
	sha,
	unit
} from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

type Cases = Parameters<typeof recordExampleCases>[1];

const unitId = 'reports.function.explorer-verdict';
const subject = unit(unitId, 'function', { title: 'explorerVerdict' });
const scenario = declared({ units: [subject.id] });
const judge = (records: ReturnType<typeof record>[], extra: Parameters<typeof revision>[3] = {}) =>
	explorerVerdict(subject, revision([subject], [scenario], records, extra));

/** Records the named cases of one state of the single symbol under test. */
function traced(state: string, cases: Cases): boolean {
	return recordExampleCases(
		{ unitId, symbol: 'explorerVerdict', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

const origin = { record: 'r0', commit: sha('b') };
const older = () =>
	complete().map((item) => ({ ...item, server: { buildId: 'build-0', revision: sha('b') } }));
const inherited = () =>
	record(
		[
			result(older(), {
				status: 'referenced',
				inherited: true,
				originTests: [{ id: 'titles-page:page', status: 'passed' }],
				testedRevision: sha('b'),
				origin
			})
		],
		{ tests: [] }
	);

const passingState = 'passing-states-prove-the-unit';
test('A unit is proven when every required state has passed captures of this commit', () => {
	const verdict = judge([record([result(complete())])]);
	expect(verdict).toEqual({ passed: true, label: 'Full coverage passed', reasons: [] });
	traced(passingState, [
		{
			name: 'every required state has passed captures of this commit',
			input: { unit: subject.id, commit: sha('a') },
			output: verdict
		}
	]);
});

const partialState = 'inherited-or-partial-judged-by-impact-and-viewport';
test('Inherited proof stands while unaffected, and a partial state is incomplete, not proven', () => {
	const unaffected = judge([inherited()], { sourceImpact: impacted(sha('b')) });
	const affected = judge([inherited()], { sourceImpact: impacted(sha('b'), [subject.id]) });
	const partial = judge([record([result([capture()])])]);
	expect(unaffected).toEqual({ passed: true, label: 'Full coverage passed', reasons: [] });
	expect(affected).toMatchObject({ passed: false, label: 'Evidence stale' });
	expect(partial).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(partial.reasons.join(' ')).toContain('empty at mobile');
	traced(partialState, [
		{
			name: 'inherited from an origin this commit does not affect',
			input: { unit: subject.id, impact: 'unaffected' },
			output: unaffected
		},
		{
			name: 'inherited from an origin this commit affects',
			input: { unit: subject.id, impact: 'affected' },
			output: affected
		},
		{
			name: 'one viewport of a required state only',
			input: { unit: subject.id, viewports: ['desktop'] },
			output: partial
		}
	]);
});

const missingState = 'missing-evidence-names-its-reason';
test('A revision with no record or no registry is missing evidence and names why', () => {
	const noRecord = judge([]);
	const noRegistry = revision([subject], [scenario], [record([])]);
	noRegistry.registry = { ...noRegistry.registry, available: false, gap: 'No registry at commit' };
	const withoutRegistry = explorerVerdict(subject, noRegistry);
	expect(noRecord).toMatchObject({ passed: false, label: 'Evidence missing' });
	expect(noRecord.reasons).toContain('No verification record is attached to this commit.');
	expect(withoutRegistry).toMatchObject({ passed: false, label: 'Evidence missing' });
	expect(withoutRegistry.reasons).toContain('No registry at commit');
	traced(missingState, [
		{
			name: 'commit with no verification record',
			input: { unit: subject.id, records: 0 },
			output: noRecord
		},
		{
			name: 'revision without a registry names its gap',
			input: { unit: subject.id, registry: 'unavailable' },
			output: withoutRegistry
		}
	]);
});
