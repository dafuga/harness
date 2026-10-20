import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import type { Gathered } from '../../src/utils/gatherCaptures';
import { scenarioCoverage } from '../../src/services/verification-service/scenarioCoverage';

const commit = 'a'.repeat(40);
const scenario = scenarioManifestSchema.parse({
	schemaVersion: 1,
	id: 'explorer-flow',
	title: 'Explorer flow',
	kind: 'headless',
	units: ['function.explorer-route'],
	states: [{ id: 'pages', title: 'Pages', coverage: 'required' }],
	viewports: [],
	tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright', target: 'tests/e2e/flow.spec.ts' }],
	evidence: [
		{
			id: 'flow',
			kind: 'output',
			states: ['pages'],
			viewports: [],
			build: 'reports',
			required: true
		}
	]
});
/** One recorded end-to-end result, as the capture index and the record hold it. */
function gathered(extra: object): Gathered {
	const line = {
		evidence: 'flow',
		kind: 'output',
		state: 'pages',
		file: 'pages-flow.json',
		mediaType: 'application/json',
		...extra
	};
	const capture = {
		...line,
		path: 'evidence/pages-flow.json',
		sha256: 'c'.repeat(64),
		bytes: 10,
		capturedAt: 'now'
	};
	return { line, capture } as unknown as Gathered;
}
const judged = (extra: object) =>
	scenarioCoverage({
		scenario,
		commit,
		gathered: [gathered(extra)],
		checkFailed: false,
		builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) }
	}).failures;
const served = (buildId: string, revision = commit) => ({
	provenance: 'actual-capture',
	server: { buildId, revision }
});

test('an end-to-end result that says it was captured from running software is bound to its build', () => {
	expect(judged(served('build-1'))).toEqual([]);
	expect(judged({ provenance: 'actual-capture' })).toEqual([
		'explorer-flow: capture pages-flow.json has no build stamp'
	]);
	expect(judged(served('build-1', 'b'.repeat(40)))[0]).toContain('pages-flow.json');
	expect(judged(served('build-0'))[0]).toContain('was served by build build-0');
});

test('a result that claims no running software is judged as before', () => {
	expect(judged({})).toEqual([]);
	expect(judged({ provenance: 'fixture' })).toEqual([]);
});
