import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { apiScreenshot } from '../src/workflows/networking-security/run-api/apiScreenshot';
import type { HarnessApiService } from '../src/services/networking-security/HarnessApiService';
import { measureWorkload } from './support/measureWorkload';

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

function focused(usable = true, status = 'passed') {
	return {
		...capture(usable, 'unvalidated'),
		scenario: 'focused',
		state: 'ok',
		focused: { loop: 'catalog-captures', status, record: 'focus1' }
	};
}

function client(captures: unknown[], served = bytes, reads: Record<string, unknown>[] = []) {
	const side = { commit: 'abc', record: { id: 'rec1', status: 'failed' }, captures };
	const data = {
		evidence: { after: side, before: null },
		identity: { notesRevision: 'n', evidenceRevision: 'e' }
	};
	return {
		snapshot: async () => ({ revision: { branch: 'main', commit: 'abc' } }),
		read: async (kind: string, query: Record<string, unknown>) => {
			reads.push({ kind, ...query });
			return kind === 'evidence' ? { data } : { bytes: served, mediaType: 'image/png' };
		}
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

test('usable captures retain regular and explicitly focused record bindings', async () => {
	await measureWorkload(
		'workflow.networking-security-run-api-api-screenshot',
		'recorded-artifact-selection-and-download',
		async () => {
			const proven = { ...capture(true, 'fresh'), state: 'ok' };
			const result = await apiScreenshot(client([capture(false, 'rejected'), proven]), 'unit', {
				output: await output()
			});
			expect(result.state).toBe('ok');
			expect(result.verification.usable).toBe(true);
			const reads: Record<string, unknown>[] = [];
			const path = await output();
			const selected = await apiScreenshot(client([focused()], bytes, reads), 'unit', {
				scenario: 'focused',
				state: 'ok',
				viewport: 'desktop',
				output: path
			});
			expect(selected.focused).toMatchObject({ status: 'passed', record: 'focus1' });
			expect(selected.verification).toMatchObject({ status: null, usable: true, record: 'focus1' });
			expect(reads.at(-1)).toMatchObject({
				kind: 'artifact',
				recordId: 'focus1',
				scenarioId: 'focused',
				state: 'ok',
				viewport: 'desktop',
				sha256: sha,
				notesRevision: 'n',
				evidenceRevision: 'e'
			});
			expect(await readFile(path)).toEqual(bytes);
		}
	);
});

test('missing, implicit and unsuccessful focused captures still error', async () => {
	const missing = [capture(false, 'fresh', null), capture(true, 'unvalidated')];
	await expect(apiScreenshot(client(missing), 'unit', { output: await output() })).rejects.toThrow(
		'No recorded screenshot matches'
	);
	await expect(
		apiScreenshot(client([focused()]), 'unit', { output: await output() })
	).rejects.toThrow('No recorded screenshot matches');
	for (const item of [
		focused(true, 'failed'),
		focused(true, 'incomplete'),
		focused(false),
		{ ...focused(), capture: { ...focused().capture, status: 'failed' } }
	]) {
		await expect(
			apiScreenshot(client([item]), 'unit', { scenario: 'focused', output: await output() })
		).rejects.toThrow('No recorded screenshot matches');
	}
});

test('a hash mismatch still errors', async () => {
	for (const item of [capture(false, 'fresh'), focused()]) {
		const tampered = client([item], Buffer.from('other bytes'));
		await expect(
			apiScreenshot(tampered, 'unit', { scenario: item.scenario, output: await output() })
		).rejects.toThrow('SHA-256 integrity check failed');
	}
});
