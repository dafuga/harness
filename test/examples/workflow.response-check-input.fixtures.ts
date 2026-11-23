import type { ResponseOptions } from './workflow.response-check-input.test.types';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	responseInputLimit,
	readResponseCheckInput,
	responseInputHashes
} from '../../src/cli/program/responseCheckInput';

export const unitId = 'workflow.response-check-input';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export async function errorOf(work: () => unknown): Promise<Error | undefined> {
	try {
		await work();
		return undefined;
	} catch (error) {
		return error as Error;
	}
}

export function writeInputFiles(
	directory: string,
	request: string,
	response: string
): ResponseOptions {
	writeFileSync(join(directory, 'request.txt'), request);
	writeFileSync(join(directory, 'response.txt'), response);
	return { request: join(directory, 'request.txt'), response: join(directory, 'response.txt') };
}

export const boundedResponseInputExample = async () => {
	await withTempDir('response-check-limit-', async (directory) => {
		const oversized = writeInputFiles(directory, 'a'.repeat(responseInputLimit + 1), 'ok');
		const fileError = await errorOf(() => readResponseCheckInput(oversized));
		const overflow = writeInputFiles(directory, 'a'.repeat(12000), 'a'.repeat(12000));
		const totalError = await errorOf(() => readResponseCheckInput(overflow));

		expect(responseInputLimit).toBe(24000);
		expect(fileError?.message).toBe(
			'Cannot read input file: use a regular UTF-8 file of at most 24000 bytes.'
		);
		expect(totalError?.message).toBe(
			'Serialized evaluation input exceeds 24000 UTF-8 bytes; no input was truncated.'
		);
		recordExampleCases(
			{
				unitId,
				symbol: 'readResponseCheckInput',
				state: 'rejects-input-beyond-the-24000-byte-limit',
				evidence: 'examples-cases',
				file: 'rejects-input-beyond-the-24000-byte-limit.json'
			},
			[
				{
					name: 'request file of 24001 bytes is unreadable',
					input: { limit: responseInputLimit, requestBytes: responseInputLimit + 1 },
					error: { name: fileError?.name, message: fileError?.message }
				},
				{
					name: 'two 12000 byte files serialize above the limit',
					input: { requestBytes: 12000, responseBytes: 12000 },
					error: { name: totalError?.name, message: totalError?.message }
				}
			]
		);
	});
};

export const responseInputHashesExample = () => {
	const input = {
		request: 'Does the release note mention the migration?',
		response: 'Yes, the release note has a migration section.',
		context: '',
		criteria: []
	};
	const hashes = responseInputHashes(input);

	expect(hashes.context).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	expect(hashes.criteria).toBe(sha256('[]'));
	expect(hashes.request).toBe(sha256(input.request));
	recordExampleCases(
		{
			unitId,
			symbol: 'responseInputHashes',
			state: 'hashes-each-input-field-with-sha-256',
			evidence: 'examples-cases',
			file: 'hashes-each-input-field-with-sha-256.json'
		},
		[{ name: 'string fields hash their text and criteria hashes its JSON', input, output: hashes }]
	);
};
