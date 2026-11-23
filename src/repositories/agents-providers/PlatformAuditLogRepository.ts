// @harness-uid u_oo3hbucsxh
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { PlatformAuditEvent } from '../../core/agents-providers/platformAdapter.types';

const flags =
	constants.O_WRONLY |
	constants.O_CREAT |
	constants.O_APPEND |
	constants.O_NOFOLLOW |
	constants.O_NONBLOCK;

/** Append host-authored metadata to an owner-only local journal. */
export class PlatformAuditLogRepository {
	constructor(private readonly path: string) {
		if (!isAbsolute(path)) throw new TypeError('A platform audit log requires an absolute path.');
	}

	async append(event: PlatformAuditEvent): Promise<void> {
		const file = await open(this.path, flags, 0o600);
		try {
			const entry = await file.stat();
			if (!entry.isFile() || (entry.mode & 0o077) !== 0 || entry.uid !== process.getuid?.())
				throw new TypeError('A platform audit log requires an owner-only regular file.');

			const bytes = Buffer.from(JSON.stringify(event) + '\n');
			if ((await file.write(bytes)).bytesWritten !== bytes.length)
				throw new TypeError('Incomplete platform audit write.');
			await file.sync();
		} finally {
			await file.close();
		}
	}
}
