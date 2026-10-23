import type { BlobRequest } from './gitBlobs.types';
import { execFile } from 'node:child_process';

export async function gitBlobs(root: string, request: BlobRequest): Promise<Map<string, Buffer>> {
	if (!request.paths.length) return new Map();
	if (request.paths.some((p) => /[\n\r\0]/.test(p))) throw new Error('Unsupported Git path.');
	const output = await new Promise<Buffer>((resolve, reject) => {
		const child = execFile(
			'git',
			['-C', root, 'cat-file', '--batch'],
			{ encoding: 'buffer', maxBuffer: 64000000 },
			(error, stdout) => (error ? reject(error) : resolve(stdout))
		);
		child.stdin?.end(request.paths.map((path) => request.revision + ':' + path).join('\n') + '\n');
	});
	return parseBlobs(output, request.paths);
}

function parseBlobs(output: Buffer, paths: string[]): Map<string, Buffer> {
	const blobs = new Map<string, Buffer>();
	let cursor = 0;
	for (const path of paths) {
		const end = output.indexOf(10, cursor),
			header = output.subarray(cursor, end).toString(),
			size = Number(header.split(' ')[2]);
		if (end < 0 || !Number.isSafeInteger(size) || size < 0 || cursor + size > output.length)
			throw new Error('Invalid Git blob response.');
		cursor = end + 1;
		blobs.set(path, output.subarray(cursor, cursor + size));
		cursor += size + 1;
	}
	return blobs;
}
