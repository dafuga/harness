import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { apiScreenshot } from '../src/workflows/networking-security/run-api/apiScreenshot';
import type { HarnessApiService } from '../src/services/networking-security/HarnessApiService';

const bytes = Buffer.from('fake png bytes');
const sha = createHash('sha256').update(bytes).digest('hex');

function capture(usable: boolean, standing: string, media: string | null = 'media/a.png') {
	return {
		scenario: 'catalog',
		state: 'failed',
		standing,
		usable,
		current: usable,
		inheritedFrom: null,
		capture: {
			evidence: 'shot',
			kind: 'screenshot',
			viewport: 'desktop',
			status: 'passed',
			sha256: sha,
			capturedAt: '2026-10-29T10:00:00Z',
			media
		}
	};
}

function client(captures: unknown[], served = bytes) {
	const side = { commit: 'abc', record: { id: 'rec1', status: 'failed' }, captures };
	const data = {
		evidence: { after: side, before: null },
		identity: { notesRevision: 'n', evidenceRevision: 'e' }
	};
	return {
		snapshot: async () => ({ revision: { branch: 'main', commit: 'abc' } }),
		read: async (kind: string) =>
			kind === 'evidence' ? { data } : { bytes: served, mediaType: 'image/png' }
	} as unknown as HarnessApiService;
}

const output = async () => join(await mkdtemp(join(tmpdir(), 'shot-')), 'shot.png');

test('a capture of a failed record is returned with its failed status', async () => {
	const path = await output();
	const result = await apiScreenshot(client([capture(false, 'fresh')]), 'unit', { output: path });
	expect(result.verification).toMatchObject({ status: 'failed', usable: false, record: 'rec1' });
	expect(result.verification.note).toContain('Not proof');
	expect(await readFile(path)).toEqual(bytes);
});

test('a usable capture is preferred over one that does not stand', async () => {
	const proven = { ...capture(true, 'fresh'), state: 'ok' };
	const result = await apiScreenshot(client([capture(false, 'rejected'), proven]), 'unit', {
		output: await output()
	});
	expect(result.state).toBe('ok');
	expect(result.verification.usable).toBe(true);
});

test('a missing capture still errors', async () => {
	const missing = [capture(false, 'fresh', null), capture(true, 'unvalidated')];
	await expect(apiScreenshot(client(missing), 'unit', { output: await output() })).rejects.toThrow(
		'No recorded screenshot matches'
	);
});

test('a hash mismatch still errors', async () => {
	const tampered = client([capture(false, 'fresh')], Buffer.from('other bytes'));
	await expect(apiScreenshot(tampered, 'unit', { output: await output() })).rejects.toThrow(
		'SHA-256 integrity check failed'
	);
});
