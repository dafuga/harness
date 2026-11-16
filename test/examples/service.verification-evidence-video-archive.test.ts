import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { VideoArchiveService } from '../../src/services/verification-evidence/VideoArchiveService';
import type { VideoBatchPointer } from '../../src/services/verification-evidence/VideoArchiveService.types';
import { digest } from '../../src/services/verification-evidence/video-archive-service/batch';
import { hashSchema } from '../../src/services/verification-evidence/video-archive-service/schema';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const MALFORMED_POINTER = { path: 'videos/batch-1.json' } as unknown as VideoBatchPointer;

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
	} catch (caught) {
		return caught;
	}
	return undefined;
}

test('Digests declared string and Buffer bytes with SHA-256', () => {
	const fromString = digest('abc');
	const fromBuffer = digest(Buffer.from('abc'));
	expect(fromString).toBe(ABC_SHA256);
	expect(fromBuffer).toBe(ABC_SHA256);
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-archive',
			symbol: 'digest',
			state: 'digests-declared-string-and-buffer-bytes-with-sha-256',
			evidence: 'examples-cases',
			file: 'digests-declared-string-and-buffer-bytes-with-sha-256.json'
		},
		[
			{ name: 'utf8 string "abc"', input: 'abc', output: fromString },
			{ name: 'Buffer of "abc"', input: 'abc', output: fromBuffer }
		]
	);
});

test('Admits only lowercase 64-character hex digests', () => {
	const valid = ABC_SHA256;
	const uppercase = ABC_SHA256.toUpperCase();
	const short = 'ba7816bf';
	expect(hashSchema.safeParse(valid).success).toBe(true);
	expect(hashSchema.safeParse(uppercase).success).toBe(false);
	expect(hashSchema.safeParse(short).success).toBe(false);
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-archive',
			symbol: 'hashSchema',
			state: 'admits-only-lowercase-64-character-hex-digests',
			evidence: 'examples-cases',
			file: 'admits-only-lowercase-64-character-hex-digests.json'
		},
		[
			{ name: 'lowercase 64-hex digest', input: valid, output: { success: true } },
			{ name: 'uppercase digest', input: uppercase, output: { success: false } },
			{ name: 'eight-character prefix', input: short, output: { success: false } }
		]
	);
});

test('Rejects a malformed pointer before reading the archive', async () => {
	await withTempRepo(async (repository) => {
		const service = new VideoArchiveService(repository.root);
		const error = await captureError(() => service.read(MALFORMED_POINTER));
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'service.verification-evidence-video-archive',
				symbol: 'VideoArchiveService.read',
				state: 'rejects-a-malformed-pointer-before-reading-the-archive',
				evidence: 'examples-cases',
				file: 'rejects-a-malformed-pointer-before-reading-the-archive.json'
			},
			[
				{
					name: 'pointer without the required schema fields',
					input: MALFORMED_POINTER,
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
