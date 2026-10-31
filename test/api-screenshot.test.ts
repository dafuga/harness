import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
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
	const side = {
		commit: 'abc',
		record: { id: 'rec1', status: 'failed', source: { commit: 'abc' } },
		detail: {
			registry: {
				scenarios: [{ id: 'catalog', viewports: [{ id: 'desktop', width: 1440, height: 900 }] }]
			}
		},
		captures
	};
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

test('an exact CSS size selects recorded viewports and focused dimensions without changing bytes', async () => {
	for (const [width, height] of [
		[1, 1],
		[390, 844],
		[777, 555],
		[1440, 900],
		[16384, 16384]
	]) {
		const sized = {
			...capture(false, 'fresh'),
			state: 'sized',
			focused: { loop: 'capture', status: 'passed', record: 'focused', viewport: { width, height } }
		};
		const options = { output: await output(), size: `${width}x${height}` };
		const other = {
			...capture(true, 'fresh'),
			focused: { record: 'other', viewport: { width: 100, height: 100 } }
		};
		const result = await apiScreenshot(client([other, sized]), 'unit', options);
		expect(result.state).toBe('sized');
		expect(result.viewport).toBe('desktop');
		expect(result.verification).toMatchObject({ usable: false, record: 'focused' });
		expect(await readFile(options.output)).toEqual(bytes);
	}
	const options = { output: await output(), size: '1440x900' };
	expect((await apiScreenshot(client([capture(true, 'fresh')]), 'unit', options)).viewport).toBe(
		'desktop'
	);
});

test('size selection requires both dimensions and original recorded viewport metadata', async () => {
	const shot = capture(true, 'fresh');
	const missingMetadata = { ...shot, focused: { loop: 'capture', record: 'focused' } };
	const inherited = { ...shot, inheritedFrom: 'older' };
	for (const size of ['1440x901', '1439x900', '390x844']) {
		const options = { output: await output(), size };
		await expect(apiScreenshot(client([shot]), 'unit', options)).rejects.toThrow(
			'No recorded screenshot matches'
		);
	}
	for (const item of [missingMetadata, inherited]) {
		const options = { output: await output(), size: '1440x900' };
		await expect(apiScreenshot(client([item]), 'unit', options)).rejects.toThrow(
			'No recorded screenshot matches'
		);
	}
});

test('malformed sizes and viewport conflicts fail before network or file access', async () => {
	const service = client([capture(true, 'fresh')]);
	const snapshot = vi.spyOn(service, 'snapshot');
	const invalid = [
		'',
		'390',
		'390X844',
		'390×844',
		'390 x 844',
		' 390x844',
		'390x844\n',
		'0x844',
		'-1x844',
		'390x0',
		'390x-1',
		'3.9x844',
		'390x8e2',
		'0390x844',
		'16385x844',
		'390x16385',
		'99999999999999999999x844'
	];
	for (const size of invalid) {
		const options = { output: await output(), size };
		await expect(apiScreenshot(service, 'unit', options)).rejects.toThrow(
			'--size must be WIDTHxHEIGHT in CSS pixels'
		);
	}
	for (const viewport of ['desktop', 'tablet', 'mobile', '']) {
		const options = { output: await output(), size: '390x844', viewport };
		await expect(apiScreenshot(service, 'unit', options)).rejects.toThrow(
			'--size and --viewport are mutually exclusive'
		);
	}
	expect(snapshot).not.toHaveBeenCalled();
});
