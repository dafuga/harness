import { writeFile } from 'node:fs/promises';
import type { ApiResponse } from '../../../adapters/networking-security/HarnessHttpAdapter.types';
import type { HarnessApiOptions } from '../../../services/networking-security/HarnessApiService.types';
import { fail } from '../../../core/development-tooling/errors';

export async function apiOutput(
	result: ApiResponse | unknown,
	options: HarnessApiOptions
): Promise<void> {
	const response = result as ApiResponse | null;
	if (response?.bytes instanceof Uint8Array && isBinary(response.mediaType)) {
		if (options.select) fail('Field selection requires a JSON response.');
		if (!options.output)
			fail('This response contains binary data; supply --output <file> or --output -.');
		await writeOutput(response.bytes, options.output);
		return;
	}
	let data = response?.bytes instanceof Uint8Array ? response.data : result;
	if (options.select) data = selected(data, options.select);
	await writeOutput(JSON.stringify(data, null, 2) + '\n', options.output);
}

function isBinary(mediaType: string): boolean {
	return !mediaType.startsWith('text/') && !mediaType.includes('json');
}

async function writeOutput(output: string | Uint8Array, destination?: string): Promise<void> {
	if (destination && destination !== '-') await writeFile(destination, output, { flag: 'wx' });
	else process.stdout.write(output);
}

function selected(data: unknown, path: string): unknown {
	for (const field of path.split('.')) {
		if (!data || typeof data !== 'object' || !Object.hasOwn(data, field))
			fail('The response has no field at the selected JSON path.');
		data = (data as Record<string, unknown>)[field];
	}
	return data;
}
