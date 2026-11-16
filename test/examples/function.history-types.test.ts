import { test } from 'vitest';
import {
	evidencePointerSchema,
	historyNoteSchema,
	evidenceFileSchema,
	evidenceManifestSchema,
	legacyRecordSchema
} from '../../src/core/git-source-history/historyTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const hash = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const pointer = { commit: hash, path: 'records/run-1', manifest: digest };

test('Validates evidence pointers and strict fields', () => {
	const valid = evidencePointerSchema.parse(pointer);
	expect(valid).toEqual(pointer);
	expect(evidencePointerSchema.safeParse({ ...pointer, extra: true }).success).toBe(false);
	recordExampleCases(
		{ unitId: 'function.history-types', symbol: 'evidencePointerSchema', state: 'validates-evidence-pointers-and-strict-fields', evidence: 'examples-cases', file: 'validates-evidence-pointers-and-strict-fields.json' },
		[{ name: 'full commit, record path and manifest digest', input: pointer, output: valid }]
	);
});

test('Validates versioned verification history notes', () => {
	const input = {
		schemaVersion: 1,
		kind: 'verification',
		record: 'run-1',
		status: 'passed',
		profile: 'desktop',
		finishedAt: '2026-01-02T03:04:05Z',
		source: { commit: hash, tree: hash, base: null },
		evidence: pointer
	};
	const parsed = historyNoteSchema.parse(input);
	const verification = parsed.kind === 'verification' ? parsed : undefined;
	expect(verification).toMatchObject({ kind: 'verification', status: 'passed', evidence: pointer });
	recordExampleCases(
		{ unitId: 'function.history-types', symbol: 'historyNoteSchema', state: 'validates-versioned-verification-history-notes', evidence: 'examples-cases', file: 'validates-versioned-verification-history-notes.json' },
		[{ name: 'passed verification note bound to source commit', input, output: { kind: verification?.kind, status: verification?.status, source: verification?.source, evidence: verification?.evidence } }]
	);
});

test('Validates evidence files and immutable manifests', () => {
	const file = { path: 'screenshots/desktop.png', sha256: digest, bytes: 1200, storage: 'git', mediaType: 'image/png' };
	const manifest = { schemaVersion: 1, record: 'run-1', source: { commit: hash, tree: hash }, status: 'passed', files: [file] };
	const parsedFile = evidenceFileSchema.parse(file);
	const parsedManifest = evidenceManifestSchema.parse(manifest);
	expect(parsedManifest.files[0]).toEqual(parsedFile);
	recordExampleCases(
		{ unitId: 'function.history-types', symbol: 'evidenceManifestSchema', state: 'validates-evidence-files-and-immutable-manifests', evidence: 'examples-cases', file: 'validates-evidence-files-and-immutable-manifests.json' },
		[{ name: 'manifest retains file hash, size and storage', input: manifest, output: { record: parsedManifest.record, status: parsedManifest.status, files: parsedManifest.files } }]
	);
});

test('Validates legacy reports while retaining missing media gaps', () => {
	const input = {
		schemaVersion: 1, kind: 'legacy-report', id: 'legacy-7', project: 'sample', title: 'Release check',
		mode: 'standard', environment: 'desktop', status: 'passed', state: 'complete',
		startedAt: '2025-12-01T10:00:00Z', updatedAt: '2025-12-01T10:05:00Z', revision: null,
		summary: 'All checks passed', checks: [{ id: 'build', title: 'Build', status: 'passed' }],
		media: [{ id: 'shot-1', title: 'Desktop', file: 'desktop.png', status: 'missing', provenance: 'legacy-report', sha256: null, bytes: null }]
	};
	const parsed = legacyRecordSchema.parse(input);
	expect(parsed.media[0]).toMatchObject({ status: 'missing', sha256: null, bytes: null });
	recordExampleCases(
		{ unitId: 'function.history-types', symbol: 'legacyRecordSchema', state: 'validates-legacy-reports-while-retaining-missing-media-gaps', evidence: 'examples-cases', file: 'validates-legacy-reports-while-retaining-missing-media-gaps.json' },
		[{ name: 'legacy report preserves unavailable screenshot metadata', input, output: { id: parsed.id, revision: parsed.revision, media: parsed.media } }]
	);
});
