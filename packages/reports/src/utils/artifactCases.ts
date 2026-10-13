import type { ExplorerArtifactCase, ExplorerArtifactCases } from '../models/ExplorerEvidence.types';

type Fields = Record<string, unknown>;

/** The form recorded calls are written in, and how much of it one result may hold. */
export const caseForm = { version: 1, kind: 'function-invocations', most: 64, name: 160 } as const;

const gap = (why: string): ExplorerArtifactCases => ({ kind: 'gap', why });
const none = gap('This result records no input and output.');
const malformed = gap('Its cases are not in the recorded form.');
const fields = (value: unknown): Fields | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
const word = (value: unknown, most: number) =>
	typeof value === 'string' && value.length > 0 && value.length <= most;

/** Existing request/response names denote observations; matcher actual/expected fields do not. */
const named = (stated: Fields, names: string[]) => names.find((name) => name in stated);

/** One call as it was recorded: an input, and either what was returned or what was thrown. */
function recorded(item: unknown): ExplorerArtifactCase | null {
	const call = fields(item);
	if (!call || !word(call.name, caseForm.name) || !('input' in call)) return null;
	const thrown = 'error' in call;
	if (thrown === 'output' in call) return null;
	const stated = { name: call.name as string, input: call.input };
	return thrown
		? { ...stated, error: call.error, failed: true }
		: { ...stated, output: call.output, failed: false };
}

/** The calls of a result in the recorded form, or null when any part of it is not. */
function calls(document: Fields): ExplorerArtifactCase[] | null {
	const list = Array.isArray(document.cases) ? document.cases : [];
	const named = word(document.unitId, 200) && word(document.symbol, 200);
	const bounded = list.length > 0 && list.length <= caseForm.most;
	if (document.schemaVersion !== caseForm.version || !named || !bounded) return null;
	const read = list.map(recorded);
	return read.every((item) => item !== null) ? (read as ExplorerArtifactCase[]) : null;
}

/**
 * The inputs a recorded result holds with what was observed for each, as rows. A result in the
 * form of recorded calls gives one row for each call of its unit; calls of another unit are not
 * shown for this one. A result that states `input` and `output` at its top gives one row: what a
 * test observed. Anything else is a gap that says why. Nothing is taken from what an assertion
 * expected or found, and a value is never judged: false, zero, null and an empty list are rows.
 */
export function artifactCases(document: unknown, unit?: string): ExplorerArtifactCases {
	const stated = fields(document);
	if (!stated) return none;
	if (stated.kind === caseForm.kind) {
		const read = calls(stated);
		if (!read) return malformed;
		if (unit !== undefined && stated.unitId !== unit)
			return gap(`Its cases are of another unit, ${String(stated.unitId)}.`);
		return { kind: 'cases', source: 'invocations', symbol: stated.symbol as string, cases: read };
	}
	const input = named(stated, ['input', 'inputs', 'request']);
	const output = named(stated, ['output', 'outputs', 'response']);
	if (!input || !output) return none;
	const seen = { name: 'Test observation', input: stated[input], output: stated[output] };
	return {
		kind: 'cases',
		source: 'observation',
		symbol: null,
		cases: [{ ...seen, failed: false }]
	};
}
