import { open, type FileHandle } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import type {
	ResponseCheckInput,
	ResponseCheckOptions,
	ResponseCheckSettings
} from '../core/responseCheckTypes';
import { ResponseCheckInputValidator } from '../validators/ResponseCheckInputValidator';

export const responseInputLimit = 24000;

export function responseCheckSettings(options: ResponseCheckOptions): ResponseCheckSettings {
	const model = options.model ?? 'jev-1.13.0';
	const minConfidence = Number(options.minConfidence ?? '0.85');
	const apiKeyEnv = options.apiKeyEnv ?? 'HARNESS_JEV_API_KEY';
	if (!/^jev-[a-zA-Z0-9.-]+$/.test(model)) throw new Error('Invalid JEV model.');
	if (!Number.isFinite(minConfidence) || minConfidence <= 0 || minConfidence > 1)
		throw new Error('Confidence threshold must be greater than 0 and at most 1.');
	if (!/^[A-Z][A-Z0-9_]*$/.test(apiKeyEnv))
		throw new Error('Invalid API key environment variable.');
	return { model, minConfidence, apiKeyEnv };
}

export async function readResponseCheckInput(
	options: ResponseCheckOptions
): Promise<ResponseCheckInput> {
	if (!options.request || !options.response)
		throw new Error('--request and --response files are required.');
	const request = await readText(options.request);
	const response = await readText(options.response);
	const context = options.context ? await readText(options.context) : '';
	const criteria = options.criteria ? await readCriteria(options.criteria) : [];
	if (!request.trim()) throw new Error('The user request must be nonempty.');
	const input = { request, response, context, criteria };
	if (Buffer.byteLength(JSON.stringify(input), 'utf8') > responseInputLimit)
		throw new Error(
			'Serialized evaluation input exceeds 24000 UTF-8 bytes; no input was truncated.'
		);
	return input;
}

export function responseInputHashes(input: ResponseCheckInput): Record<string, string> {
	return Object.fromEntries(
		Object.entries(input).map(([key, value]) => [
			key,
			createHash('sha256')
				.update(typeof value === 'string' ? value : JSON.stringify(value))
				.digest('hex')
		])
	);
}

async function readText(path: string): Promise<string> {
	try {
		const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
		try {
			if (!(await file.stat()).isFile()) throw new Error('Not a file');
			const buffer = Buffer.alloc(responseInputLimit + 1);
			const bytesRead = await readBounded(file, buffer);
			if (bytesRead > responseInputLimit) throw new Error('Too large');
			return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
		} finally {
			await file.close();
		}
	} catch {
		throw new Error('Cannot read input file: use a regular UTF-8 file of at most 24000 bytes.');
	}
}

async function readCriteria(path: string) {
	const text = await readText(path);
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('Criteria file must contain valid JSON.');
	}
	return new ResponseCheckInputValidator().validateCriteria(raw);
}

async function readBounded(file: FileHandle, buffer: Buffer): Promise<number> {
	let total = 0;
	while (total < buffer.length) {
		const { bytesRead } = await file.read(buffer, total, buffer.length - total, total);
		if (bytesRead === 0) break;
		total += bytesRead;
	}
	return total;
}
