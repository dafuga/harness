import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import type { EntityEvidenceResult } from '../../../desktop/src/models/DesktopEvidence.types';
import { artifactLimit } from '../../../desktop/src/utils/artifactMedia';
import {
	asked,
	bound,
	evidenceFixture,
	outsider,
	project,
	read,
	type EvidenceFixture
} from '../support/evidenceFixture';
import { clock, png, sha256 } from '../support/evidenceRecords';

type Fields = Record<string, string | null | undefined>;
const tipOf = (f: EvidenceFixture) => asked(f.commits.changed, 'verified', 'current');

/** A request as the client sends it: a field that is null is left out of the address. */
function get(operation: string, fields: object): Request {
	const { projectId, ...query } = fields as Fields;
	const url = new URL(`https://fixture.example/api/projects/${projectId}/${operation}`);
	for (const [name, value] of Object.entries(query))
		if (value !== null && value !== undefined) url.searchParams.set(name, value);
	return new Request(url);
}
async function refused(f: EvidenceFixture, request: Request) {
	const response = await f.controller.handle(request);
	return [response.status, ((await response.json()) as { error: string }).error];
}

test('evidence is answered as JSON that is not stored by a browser', async () => {
	const f = evidenceFixture();
	const response = await f.controller.handle(get('evidence', tipOf(f)));
	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('Content-Type')).toMatch(/^application\/json/);
	const result = (await response.json()) as EntityEvidenceResult;
	expect(result).toEqual(JSON.parse(JSON.stringify(await read(f, tipOf(f)))));
	expect(result.scope).toMatchObject({ mode: 'current', commit: f.commits.changed });
	expect(result.identity).toMatchObject({ projectId: project.id, ...f.pins });
});

test('an artifact is answered as its bytes, with the attested type and no sniffing', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const response = await f.controller.handle(get('artifact', query));
	expect(response.status).toBe(200);
	expect(response.headers.get('Content-Type')).toBe('image/png');
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	expect(sha256(new Uint8Array(await response.arrayBuffer()))).toBe(query.sha256);
	// A capture without a viewport is asked for without that field, and so read as null.
	const kept = asked(f.commits.changed, 'main', 'commit', clock);
	const text = bound(await read(f, kept), kept);
	expect(text.viewport).toBeNull();
	const plain = await f.controller.handle(get('artifact', text));
	expect(plain.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
	expect(await plain.text()).toBe('tick\n');
});

test('nobody without a session or a membership reaches the source or the cache', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const [calls, reads] = [f.calls.length, f.reads.length];
	for (const who of [null, outsider]) {
		f.signIn(who);
		const expected = who ? [403, 'forbidden'] : [401, 'session-required'];
		expect(await refused(f, get('evidence', tipOf(f)))).toEqual(expected);
		expect(await refused(f, get('artifact', query))).toEqual(expected);
	}
	expect([f.calls.length, f.reads.length]).toEqual([calls, reads]);
});

test('every field of a read is checked, and what is not a field is never used', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const calls = f.calls.length;
	const scope: Fields[] = [
		{ entityId: 'Page.Titles' },
		{ entityId: '../page' },
		{ commit: 'main' },
		{ commit: query.commit.slice(0, 39) },
		{ branch: null },
		{ branch: 'b'.repeat(256) },
		{ mode: 'tip' },
		{ mode: null }
	];
	const capture: Fields[] = [
		{ side: 'both' },
		{ recordId: query.recordId.slice(0, 40) },
		{ scenarioId: 'titles/page' },
		{ state: 'Default' },
		{ evidenceId: '..' },
		{ viewport: 'desk top' },
		{ sha256: query.sha256.toUpperCase() },
		{ notesRevision: 'refs/notes/harness' },
		{ evidenceRevision: query.commit.slice(0, 12) }
	];
	for (const wrong of scope)
		expect(await refused(f, get('evidence', { ...tipOf(f), ...wrong }))).toEqual([
			400,
			'invalid-input'
		]);
	for (const wrong of [...scope, ...capture])
		expect(await refused(f, get('artifact', { ...query, ...wrong }))).toEqual([
			400,
			'invalid-input'
		]);
	expect(f.calls.length).toBe(calls);
	const extra = { ...query, path: '../../secret', url: 'https://example.invalid/x', kind: 'html' };
	const response = await f.controller.handle(get('artifact', extra));
	expect([response.status, response.headers.get('Content-Type')]).toEqual([200, 'image/png']);
});

test('each refusal has its own code and status', async () => {
	const f = evidenceFixture();
	const { changed, side } = f.commits;
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const stale = get('evidence', asked(changed, 'main', 'current'));
	expect(await refused(f, stale)).toEqual([409, 'evidence-stale']);
	const outside = get('evidence', asked(side, 'verified', 'commit'));
	expect(await refused(f, outside)).toEqual([404, 'evidence-unreadable']);
	const unknown = get('artifact', { ...query, notesRevision: 'f'.repeat(40) });
	expect(await refused(f, unknown)).toEqual([409, 'evidence-stale']);
	const unlisted = get('artifact', { ...query, sha256: 'a'.repeat(64) });
	expect(await refused(f, unlisted)).toEqual([404, 'artifact-refused']);
	const large = evidenceFixture({ screens: png('more', artifactLimit + 1) });
	const big = bound(await read(large, tipOf(large)), tipOf(large));
	expect(await refused(large, get('artifact', big))).toEqual([413, 'artifact-too-large']);
});

test('neither read is offered to a request that is not a GET', async () => {
	const f = evidenceFixture();
	for (const operation of ['evidence', 'artifact']) {
		const request = new Request(get(operation, tipOf(f)), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
		expect((await f.controller.handle(request)).status).toBe(405);
	}
	expect(objectReadsOf(f)).toBe(0);
});

function objectReadsOf(f: EvidenceFixture): number {
	return f.calls.filter((call) => call.startsWith('blob ')).length;
}
