// @harness-uid u_2eznkaf4qv
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

export function captureDigest(bytes: string | Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}
/** Bound every finalized native-object read before allocation and reject symlinks or drift. */
export function captureFile(path: string, sha256: string): Buffer {
	const bytes = boundedCaptureBytes(path, 8 * 1024 * 1024);
	if (captureDigest(bytes) !== sha256)
		throw new ExpectedCliError('Native canonical object hash changed before archive admission.');
	return bytes;
}
export function captureText(path: string, maximum: number): string {
	return boundedCaptureBytes(path, maximum).toString('utf8');
}
function boundedCaptureBytes(path: string, maximum: number): Buffer {
	const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.size < 1 || stat.size > maximum)
			throw new ExpectedCliError('Native canonical object exceeds bounded capture admission.');
		const bytes = Buffer.alloc(stat.size);
		let offset = 0;
		while (offset < bytes.length) {
			const read = readSync(fd, bytes, offset, bytes.length - offset, null);
			if (!read) break;
			offset += read;
		}
		if (offset !== bytes.length || fstatSync(fd).size !== bytes.length)
			throw new ExpectedCliError('Native canonical object changed before child archive admission.');
		return bytes;
	} finally {
		closeSync(fd);
	}
}
