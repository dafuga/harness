// @harness-uid u_zhz7hjx43x
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { FrameFlag } from '../FrameFlagService.types';

/** Fixed allocation and descriptor checks precede reading any retained PNG bytes. */
export async function readFlagFrame(root: string, flag: FrameFlag): Promise<Buffer> {
	const size = flag.frame.bytes;
	if (!Number.isSafeInteger(size) || size < 24 || size > 8 * 1024 * 1024) invalidFrame();
	const file = await open(
		await new LfsAdapter(root).path(flag.frame.sha256),
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch(() => invalidFrame());
	try {
		const before = await file.stat();
		if (!before.isFile() || before.size !== size) invalidFrame();
		const bytes = Buffer.alloc(size);
		let offset = 0;
		while (offset < size) {
			const read = await file.read(bytes, offset, size - offset, offset);
			if (read.bytesRead === 0) invalidFrame();
			offset += read.bytesRead;
		}
		const after = await file.stat();
		if (after.size !== size || after.mtimeMs !== before.mtimeMs) invalidFrame();
		return bytes;
	} finally {
		await file.close();
	}
}
function invalidFrame(): never {
	throw new ExpectedCliError('Retained frame hash/integrity is corrupt or unavailable.');
}
