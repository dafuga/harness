import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { videoCaptureFixture } from './videoCaptureFixture';

/** A reused descriptor may not append through a capture-index symlink into another file. */
export async function assertCaptureIndexOwnership(
	f: Awaited<ReturnType<typeof videoCaptureFixture>>
) {
	const options = f.options(),
		target = join(f.root, '.cache/foreign-metadata.txt');
	writeFileSync(target, 'preserve this other file');
	mkdirSync(options.directory);
	symlinkSync(target, join(options.directory, 'captures.ndjson'));
	await expect(f.service.record(options)).rejects.toThrow(/symlink|regular/i);
	expect(readFileSync(target, 'utf8')).toBe('preserve this other file');
}
