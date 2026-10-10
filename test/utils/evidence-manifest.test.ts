import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { evidenceManifestSchema } from '../../src/core/historyTypes';
import { evidenceManifest, recordFiles } from '../../src/utils/evidenceManifest';
import { verificationSample } from '../support/verificationSample';

const digest = (letter: string) => letter.repeat(64);
const capture = (path: string, hash: string, mediaType: string) => ({
	evidence: 'shot',
	kind: 'screenshot' as const,
	state: 'default',
	status: 'passed' as const,
	path,
	sha256: digest(hash),
	bytes: 10,
	mediaType,
	capturedAt: '2026-10-10T00:00:00.000Z'
});
const record: VerificationRecord = {
	...verificationSample(),
	tests: [
		{
			id: 'unit',
			kind: 'unit',
			runner: 'vitest',
			target: 'test/a.test.ts',
			status: 'passed',
			durationMs: 1,
			log: { path: 'logs/unit.log', sha256: digest('1'), bytes: 3 }
		}
	],
	scenarios: [
		{
			id: 'page',
			status: 'passed',
			testedRevision: 'a'.repeat(40),
			states: [
				{
					id: 'default',
					coverage: 'required',
					captures: [
						capture('evidence/page/shot.png', '2', 'image/png'),
						capture('evidence/page/out.txt', '3', 'text/plain')
					]
				}
			]
		},
		{
			id: 'clock',
			status: 'referenced',
			testedRevision: 'b'.repeat(40),
			referencedRecord: 'earlier',
			states: [
				{
					id: 'default',
					coverage: 'required',
					captures: [capture('evidence/clock/old.png', '4', 'image/png')]
				}
			]
		}
	]
};

test('recordFiles lists the captures this run produced and its logs, not inherited ones', () => {
	expect(recordFiles(record).map((file) => file.path)).toEqual([
		'evidence/page/shot.png',
		'evidence/page/out.txt',
		'logs/unit.log'
	]);
});

test('evidenceManifest states the original hash, size and storage of every file', () => {
	const bytes = Buffer.from('{"record":true}\n');
	const manifest = evidenceManifest(record, bytes);
	expect(evidenceManifestSchema.safeParse(manifest).success).toBe(true);
	expect(manifest.files).toEqual([
		{
			path: 'record.json',
			sha256: createHash('sha256').update(bytes).digest('hex'),
			bytes: bytes.length,
			storage: 'git'
		},
		{
			path: 'evidence/page/shot.png',
			sha256: digest('2'),
			bytes: 10,
			mediaType: 'image/png',
			storage: 'lfs'
		},
		{
			path: 'evidence/page/out.txt',
			sha256: digest('3'),
			bytes: 10,
			mediaType: 'text/plain',
			storage: 'git'
		},
		{ path: 'logs/unit.log', sha256: digest('1'), bytes: 3, storage: 'git' }
	]);
	expect([manifest.record, manifest.status, manifest.source]).toEqual([
		record.id,
		record.status,
		{ commit: record.source.commit, tree: record.source.tree }
	]);
});
