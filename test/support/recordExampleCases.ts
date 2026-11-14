import { caseForm } from '../../packages/reports/src/utils/explorer-ui/artifactCases';
import { recordCapture } from '../../src/utils/record-capture/recordCapture';

/** Records named calls and their observed inputs and results as a function-invocations trace. */
export function recordExampleCases(
	{ unitId, symbol, state, evidence, file }: {
		unitId: string;
		symbol: string;
		state: string;
		evidence: string;
		file: string;
	},
	cases: Array<
		{ name: string; input: unknown } &
			({ output: unknown; error?: never } | { error: unknown; output?: never })
	>,
	env = process.env
): boolean {
	if (cases.length > caseForm.most) throw new RangeError(`At most ${caseForm.most} cases may be recorded.`);
	if (cases.some(({ name }) => name.length > caseForm.name))
		throw new RangeError(`Case names may be at most ${caseForm.name} characters.`);

	const document = { schemaVersion: 1, kind: caseForm.kind, unitId, symbol, cases };
	return recordCapture(
		{ evidence, kind: 'trace', state, file, mediaType: 'application/json' },
		JSON.stringify(document, null, '\t'),
		env
	);
}
