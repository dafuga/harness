import { expect, test } from 'vitest';
import {
	mutationMethods,
	projectlessMethods,
	readMethods,
	remoteMethods
} from '../../remote/src/index';
import { channels } from '../src/models/DesktopBridge.types';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../src/models/DesktopEvidence.types';
import { binaryAnswer } from '../src/utils/binaryAnswer';
import { IpcRequestValidator } from '../src/validators/IpcRequestValidator';

const commit = 'a'.repeat(40);
const sha256 = 'b'.repeat(64);
const pinned = 'c'.repeat(40);
const query: EntityEvidenceQuery = {
	projectId: 'project-1',
	entityId: 'desktop.page.root',
	commit,
	branch: 'main',
	mode: 'commit'
};
const artifact: EvidenceArtifactQuery = {
	...query,
	side: 'before',
	recordId: sha256,
	scenarioId: 'titles-page',
	state: 'filled',
	evidenceId: 'screens',
	viewport: 'mobile',
	sha256,
	notesRevision: pinned,
	evidenceRevision: pinned
};
const read = channels as Record<string, string>;
const parse = (channel: string, input: unknown) => new IpcRequestValidator().parse(channel, input);
const without = (key: string): Record<string, unknown> => {
	const rest: Record<string, unknown> = { ...artifact };
	delete rest[key];
	return rest;
};

test('evidence and artifact are reads of a granted project on every transport', () => {
	expect(channels).toMatchObject({ evidence: 'evidence:read', artifact: 'evidence:artifact' });
	for (const method of ['evidence', 'artifact']) {
		expect(readMethods as readonly string[]).toContain(method);
		expect(remoteMethods as readonly string[]).toContain(method);
		expect(mutationMethods as readonly string[]).not.toContain(method);
		expect(projectlessMethods as readonly string[]).not.toContain(method);
	}
});

test('an evidence query keeps exactly its fields', () => {
	const padded = { ...query, path: '/etc/passwd', url: 'https://example.invalid/x' };
	expect(parse(read.evidence, padded)).toEqual(query);
	expect(parse(read.evidence, { ...query, mode: 'current' })).toEqual({
		...query,
		mode: 'current'
	});
	const refused = [
		{ mode: 'latest' },
		{ branch: '' },
		{ branch: undefined },
		{ commit: 'HEAD' },
		{ entityId: '../other' }
	];
	for (const bad of refused) expect(() => parse(read.evidence, { ...query, ...bad })).toThrow();
});

test('an artifact query names a capture by its binding, never by a path or an address', () => {
	const padded = { ...artifact, path: 'records/x', url: 'file:///x', media: 'media/x.png' };
	expect(parse(read.artifact, padded)).toEqual(artifact);
	const unpinned = { ...artifact, viewport: null, notesRevision: null, evidenceRevision: null };
	expect(parse(read.artifact, unpinned)).toEqual(unpinned);
	const refused = [
		{ side: 'both' },
		{ mode: 'all' },
		{ sha256: 'b'.repeat(63) },
		{ recordId: 'latest' },
		{ scenarioId: '../other' },
		{ state: 'a/b' },
		{ evidenceId: '' },
		{ viewport: 'a b/..' },
		{ notesRevision: 'main' },
		{ evidenceRevision: 'HEAD' }
	];
	for (const bad of refused) expect(() => parse(read.artifact, { ...artifact, ...bad })).toThrow();
	const bound = ['side', 'recordId', 'scenarioId', 'state', 'evidenceId', 'viewport', 'sha256'];
	for (const key of [...bound, 'notesRevision', 'evidenceRevision'])
		expect(() => parse(read.artifact, without(key))).toThrow();
});

test('an artifact travels as checked bytes with its own media type', () => {
	const bytes = new TextEncoder().encode('{"ok":true}');
	const answer = (binaryAnswer as (bytes: Uint8Array, mediaType?: string) => object)(
		bytes,
		'application/json'
	);
	expect(answer).toMatchObject({
		encoding: 'base64',
		mediaType: 'application/json',
		byteLength: bytes.length
	});
	expect(binaryAnswer(bytes).mediaType).toBe('image/png');
});
