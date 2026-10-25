import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { RemoteFailure, remoteLimits } from '../../src/models/Remote.types';
import { WireMessageValidator } from '../../src/validators/WireMessageValidator';

const id = '8775318f-d765-4e78-9d40-6cb92e1f6b11',
	validator = new WireMessageValidator();
/** Authored in the proposed unit manifest, so expectations never come from the validator. */
const manifest = JSON.parse(
	readFileSync(
		new URL('../../../../test/fixtures/contract-migration/wire-methods.json', import.meta.url),
		'utf8'
	)
) as {
	testing: {
		cases: {
			id: string;
			test: { title: string };
			expected: { value: { rows: { name: string; input: unknown; expected: object }[] } };
		}[];
	};
};
/** Inputs the manifest names but cannot spell out: text at the exact byte and character bounds. */
const builders = {
	asciiTextAboveRequestBytes: () => envelope({ text: 'x'.repeat(remoteLimits.requestBytes) }),
	multibyteTextAboveRequestBytes: () => {
		const text = envelope({ text: 'é'.repeat(remoteLimits.requestBytes / 2) });
		expect(text.length).toBeLessThan(remoteLimits.requestBytes);
		return text;
	}
};

test('request admits only listed request envelopes and refuses the rest by code, keeping any usable request id', () => {
	runMatrix('request-initialized', (text) => validator.request(text));
});
test('message admits only response and event envelopes and refuses every other message as invalid', () => {
	runMatrix('message-initialized', (text) => validator.message(text));
});

/** Runs each authored row of one method case; the registered title must match the manifest. */
function runMatrix(caseId: string, call: (text: string) => unknown): void {
	const item = manifest.testing.cases.find((candidate) => candidate.id === caseId);
	if (!item) throw new Error(`Missing contract case ${caseId}`);
	expect(expect.getState().currentTestName).toBe(item.test.title);
	for (const row of item.expected.value.rows)
		expectOutcome(
			row.name,
			outcome(() => call(inputText(row.input))),
			row.expected
		);
}
/** What a caller observes: the returned value, or the failure's code and request id (null when absent). */
function outcome(run: () => unknown): object {
	try {
		return { value: run() };
	} catch (error) {
		if (!(error instanceof RemoteFailure)) throw error;
		return { error: { code: error.code, requestId: error.requestId ?? null } };
	}
}
/** Error rows assert only the fields they author; value rows must match exactly. */
function expectOutcome(name: string, observed: object, expected: object): void {
	if ('error' in expected) expect(observed, name).toMatchObject(expected);
	else expect(observed, name).toEqual(expected);
}
/** Raw text rows are sent as written; other rows are envelopes, stringified as they travel. */
function inputText(input: unknown): string {
	if (typeof input === 'string') return input;
	const builder = (input as { builder?: keyof typeof builders }).builder;
	return builder ? builders[builder]() : JSON.stringify(input);
}
function envelope(input: object): string {
	return JSON.stringify({ type: 'request', id, method: 'snapshot', input });
}
