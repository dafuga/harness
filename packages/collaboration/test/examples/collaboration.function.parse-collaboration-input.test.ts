import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	actorSchema,
	anchorSchema,
	digest,
	fail,
	parseCollaborationInput,
	safePath
} from '../../src/utils/planning-collaboration/parseCollaborationInput';
import { CollaborationInputError } from '../../src/utils/planning-collaboration/parseCollaborationInput.types';

const unitId = 'collaboration.function.parse-collaboration-input';

type Outcome = { output: unknown } | { error: { name: string; code: unknown; message: string } };

/** Runs a call and summarises either its return value or the error it threw. */
function settle(run: () => unknown): Outcome {
	try {
		return { output: run() };
	} catch (caught) {
		const error = caught as Error & { code?: unknown };
		return { error: { name: error.name, code: error.code, message: error.message } };
	}
}

function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

const verifiedActor = {
	id: 'reviewer-0142',
	email: 'Reviewer@Example.com',
	name: 'Release reviewer',
	emailVerified: true
};

const digestOfAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const anchor = {
	branch: 'main',
	commit: '0123456789abcdef0123456789abcdef01234567',
	entityId: 'reports.component.evidence-grid',
	version: 'v012',
	imageSha256: digestOfAbc,
	state: 'Mobile checkout',
	viewport: 'desktop',
	region: null
};

const unanchoredImage = {
	...anchor,
	version: null,
	imageSha256: digestOfAbc
};

test('Parses a verified actor and lowercases its email', () => {
	const unverified = { ...verifiedActor, emailVerified: false };
	const parsed = parseCollaborationInput(actorSchema, verifiedActor);
	const rejected = settle(() => parseCollaborationInput(actorSchema, unverified));

	expect(parsed).toEqual({ ...verifiedActor, email: 'reviewer@example.com' });
	expect(rejected).toEqual({
		error: { name: 'CollaborationInputError', code: 'invalid-input', message: 'Collaboration invalid-input' }
	});
	recordExampleCases(meta('parseCollaborationInput', 'parses-a-verified-actor-and-lowercases-its-email'), [
		{ name: 'parse a verified reviewer', input: verifiedActor, output: parsed },
		{ name: 'parse an unverified reviewer', input: unverified, ...rejected }
	]);
});

test('Rejects an anchor whose image fields are inconsistent', () => {
	const nullImage = { ...anchor, imageSha256: null, version: null, state: null, viewport: null, region: null };
	const cases = [
		{ name: 'accept a desktop anchor with an image', input: anchor },
		{ name: 'accept an anchor with null image fields', input: nullImage },
		{ name: 'reject an image without a version', input: unanchoredImage }
	].map((item) => ({ ...item, ...settle(() => parseCollaborationInput(anchorSchema, item.input)) }));

	expect(cases.map((item) => ('error' in item ? item.error.code : 'accepted'))).toEqual([
		'accepted',
		'accepted',
		'invalid-input'
	]);
	recordExampleCases(meta('parseCollaborationInput', 'rejects-an-anchor-whose-image-fields-are-inconsistent'), cases);
});

test('Digests bytes with SHA-256 as lowercase hex', async () => {
	const empty = await digest(new Uint8Array());
	const abc = await digest(new TextEncoder().encode('abc'));
	const sha384 = await digest(new TextEncoder().encode('abc'), 'SHA-384');

	expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	expect(abc).toBe(digestOfAbc);
	expect(sha384).toHaveLength(96);
	recordExampleCases(meta('digest', 'digests-bytes-with-sha-256-as-lowercase-hex'), [
		{ name: 'digest empty input with the default algorithm', input: { bytes: '', algorithm: 'SHA-256' }, output: empty },
		{ name: 'digest abc with the default algorithm', input: { bytes: 'abc', algorithm: 'SHA-256' }, output: abc },
		{ name: 'digest abc with SHA-384', input: { bytes: 'abc', algorithm: 'SHA-384' }, output: { length: sha384.length } }
	]);
});

test('Accepts safe repository paths and rejects unsafe ones', () => {
	const paths = [
		'reports/component/evidence-grid.json',
		'../secrets.txt',
		'/etc/hosts',
		'docs\\roadmap.md',
		'docs//roadmap.md'
	];
	const cases = paths.map((value) => ({ name: `check ${value}`, input: value, ...settle(() => safePath(value)) }));

	expect(cases.map((item) => ('error' in item ? item.error.code : 'accepted'))).toEqual([
		'accepted',
		'invalid-path',
		'invalid-path',
		'invalid-path',
		'invalid-path'
	]);
	expect(() => fail('invalid-path')).toThrow(CollaborationInputError);
	recordExampleCases(meta('safePath', 'accepts-safe-repository-paths-and-rejects-unsafe-ones'), cases);
});
