import type { HarnessCapture } from '../src/models/Harness.types';
import type { BehaviorCell } from '../src/utils/entityBehavior';
import { artifactBehavior } from '../src/utils/explorer-reading/explorerArtifact';

/** Recorded results as a function is shown with them, and the rows each must be drawn as. */
export const unit = 'desktop.function.compose-modes';
const capture: HarnessCapture = {
	evidence: 'function-cases',
	kind: 'trace',
	state: 'cases',
	status: 'passed',
	path: 'evidence/cases.json',
	sha256: 'a'.repeat(64),
	mediaType: 'application/json',
	capturedAt: '2026-10-13T12:00:00.000Z',
	media: 'media/cases.json'
};
/** A result whose bytes were read and have the hash its capture states. */
export const stored = (document: unknown): BehaviorCell => ({
	outcome: 'passed',
	capture,
	read: {
		verified: true,
		problem: null,
		text: JSON.stringify(document),
		document,
		behavior: artifactBehavior(document)
	}
});
const tampered = 'The bytes that were read do not have the recorded SHA-256.';
export const unavailable: Record<string, [BehaviorCell, string]> = {
	absent: [{ outcome: 'missing', capture: null }, 'Not recorded'],
	'not stored': [
		{ outcome: 'passed', capture: { ...capture, media: null, gap: 'Its bytes were not kept.' } },
		'Its bytes were not kept.'
	],
	unread: [{ outcome: 'passed', capture }, 'Reading what it holds…'],
	tampered: [
		{
			outcome: 'passed',
			capture,
			read: { verified: false, problem: tampered, text: '{}', document: null, behavior: null }
		},
		tampered
	]
};

const call = (name: string, input: unknown, output: unknown) => ({ name, input, output });
/** Calls of one symbol: a list, an empty list, false, zero, null and a thrown error. */
export const calls = {
	schemaVersion: 1,
	kind: 'function-invocations',
	unitId: unit,
	symbol: 'composeModes',
	cases: [
		call('comments only', [{ comments: true, agents: false }, false], ['comment']),
		call('nothing allowed', [{ comments: false, agents: false }, false], []),
		call('a flag that is off', 'flag', false),
		call('none left', 3, 0),
		call('no value', 'missing', null),
		{ name: 'refused', input: 'bad', error: { name: 'TypeError', message: 'Not a capability' } }
	]
};
/** What a test observed end to end: an input and an output at the top, and what it asserted. */
export const observed = {
	scenario: 'Search across synthetic orders',
	environment: 'Bun · headless',
	steps: ['Open the orders page'],
	input: { searchText: 'SERVICE' },
	output: ['Order 1042 · Service call'],
	assertions: [
		{ name: 'Matching order is listed', passed: true, detail: { expected: 12, found: 12 } }
	]
};
/** What a test compared, and nothing it was given or answered. */
export const compared = {
	actual: 5,
	expected: 5,
	assertions: [{ name: 'Total matches', passed: true, detail: { expected: 5, actual: 5 } }]
};
const one = calls.cases[0];
const form = (change: object) => ({ ...calls, cases: [one], ...change });
export const malformed: unknown[] = [
	form({ schemaVersion: 2 }),
	form({ cases: 'comments only' }),
	form({ cases: [] }),
	form({ cases: Array.from({ length: 65 }, () => one) }),
	form({ cases: [{ name: 'no input', output: 1 }] }),
	form({ cases: [{ name: 'both', input: 1, output: 1, error: 'failed' }] }),
	form({ cases: [{ name: 'neither', input: 1 }] }),
	form({ cases: [{ name: 7, input: 1, output: 1 }] }),
	form({ unitId: undefined }),
	form({ symbol: '' })
];
export const elsewhere = form({ unitId: 'desktop.function.other' });
export const gaps = {
	none: 'This result records no input and output.',
	malformed: 'Its cases are not in the recorded form.',
	elsewhere: 'Its cases are of another unit, desktop.function.other.'
};

export const flat = (text: string) => text.replace(/\s+/g, '');
const plain = (markup: string) =>
	markup
		.replace(/<[^>]+>/g, ' ')
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&amp;/g, '&');
/** The cells of every table row of a drawn result, each without its white space. */
export function rows(body: string): string[][] {
	return [...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((row) =>
		[...row[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((cell) => flat(plain(cell[1])))
	);
}
export const words = (body: string) => plain(body).replace(/\s+/g, ' ').trim();
const head = ['Case', 'Input', 'Observedoutput'];
export const callRows = [
	head,
	['commentsonly', 'CommentsBooleantrueAgentsBooleanfalseBooleanfalse', 'Textcomment'],
	['nothingallowed', 'CommentsBooleanfalseAgentsBooleanfalseBooleanfalse', 'Emptylist'],
	['aflagthatisoff', 'Textflag', 'Booleanfalse'],
	['noneleft', 'Number3', 'Number0'],
	['novalue', 'Textmissing', 'Nullnull'],
	['refused', 'Textbad', 'ObservederrorNameTextTypeErrorMessageTextNotacapability']
];
export const observedRows = [
	head,
	['Testobservation', 'SearchtextTextSERVICE', 'TextOrder1042·Servicecall']
];
