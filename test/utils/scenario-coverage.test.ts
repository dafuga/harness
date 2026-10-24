import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import type { Gathered } from '../../src/utils/gatherCaptures';
import { scenarioCoverage } from '../../src/services/verification-service/scenarioCoverage';
import { captureLineSchema } from '../../src/core/verification-evidence/verifyTypes';
import { captureSchema } from '../../src/core/verification-evidence/verificationTypes';

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

const region = { x: 12, y: 56, width: 158, height: 50 };
function picture(mode = 'element', scale = 1) {
	return scenarioManifestSchema.parse({
		...scenario,
		kind: 'ui',
		viewports: [{ id: 'desktop', width: 920, height: 700, scale }],
		evidence: [
			{ ...scenario.evidence[0], kind: 'screenshot', viewports: ['desktop'], capture: mode }
		]
	});
}
function image(extra: object = {}, width = 158, height = 50): Gathered {
	return {
		...gathered({
			kind: 'screenshot',
			mediaType: 'image/png',
			viewport: 'desktop',
			clip: region,
			...served('build-1'),
			...extra
		}),
		facts: { kind: 'image', width, height }
	};
}
const imageFailures = (item: Gathered, mode = 'element', scale = 1) =>
	scenarioCoverage({
		scenario: picture(mode, scale),
		commit,
		gathered: [item],
		checkFailed: false,
		builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) }
	}).failures;

test('element captures retain explicit bounds in wire and stored evidence', () => {
	const item = image();
	expect(captureLineSchema.parse(item.line)).toHaveProperty('clip', region);
	expect(captureSchema.parse(item.capture)).toHaveProperty('clip', region);
	expect(imageFailures(item)).toEqual([]);
	expect(imageFailures(image({}, 316, 100), 'element', 2)).toEqual([]);
});

test('element captures reject absent or mismatched bounds and retain build checks', () => {
	expect(imageFailures(image({ clip: undefined }))[0]).toContain('requires capture bounds');
	expect(imageFailures(image({}, 920, 700))[0]).toContain('does not match');
	expect(imageFailures(image({ clip: { ...region, x: 900 } }))[0]).toContain('outside viewport');
	expect(imageFailures(image(served('build-0')))[0]).toContain('was served by build build-0');
	expect(imageFailures(image(served('build-1', 'b'.repeat(40))))[0]).toContain('not');
	for (const clip of [
		{ ...region, width: 0 },
		{ ...region, x: -1 }
	])
		expect(captureLineSchema.safeParse({ ...image().line, clip }).success).toBe(false);
});

test('viewport and full-page evidence retain their original dimensions', () => {
	expect(imageFailures(image({}, 920, 700), 'viewport')).toEqual([]);
	expect(imageFailures(image({}, 920, 900), 'full-page')).toEqual([]);
	expect(imageFailures(image(), 'viewport')[0]).toContain('requires 920x700');
	expect(imageFailures(image(), 'full-page')[0]).toContain('920 wide and at least 700 tall');
});
