import { test } from 'vitest';
import { recordCapture } from '../../../src/utils/recordCapture';
import { expect } from '../../../test/verificationExpect';
import type { ProjectCapabilities } from '../src/models/ProjectContext.types';
import { composeModes } from '../src/utils/composeModes';

/**
 * The real composeModes, called with the capabilities of four synthetic projects. What it was
 * given and what it returned is asserted exactly and recorded as cases, for a function to be
 * shown by. Nothing here is a plan, and no expectation is written down as a result.
 */
const project = (change: Partial<ProjectCapabilities>): ProjectCapabilities => ({
	comments: true,
	agents: false,
	planning: false,
	approval: false,
	source: 'github',
	...change
});
const local = project({ agents: true, planning: true, approval: true, source: 'local' });
const asked: Array<[string, ProjectCapabilities, boolean]> = [
	['hosted project, comments only', project({}), false],
	['local project at a writable tip', local, true],
	['local project at a historical commit', local, false],
	['project without comments or agents', project({ comments: false }), false]
];

test('composeModes returns comment, plan and change only where each is allowed', () => {
	const cases = asked.map(([name, capabilities, writable]) => ({
		name,
		input: [capabilities, writable],
		output: composeModes(capabilities, writable)
	}));
	expect(cases.map((item) => item.output)).toEqual([
		['comment'],
		['comment', 'plan', 'change'],
		['comment'],
		[]
	]);
	expect(cases.map((item) => item.input[1])).toEqual([false, true, false, false]);
	const document = {
		schemaVersion: 1,
		kind: 'function-invocations',
		unitId: 'desktop.function.compose-modes',
		symbol: 'composeModes',
		cases
	};
	recordCapture(
		{
			evidence: 'function-examples-cases',
			kind: 'trace',
			state: 'compose-modes',
			file: 'compose-modes-cases.json',
			mediaType: 'application/json'
		},
		JSON.stringify(document, null, '\t')
	);
});
