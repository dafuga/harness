// @harness-uid u_w4n6xl3lyw
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';

/** Reads only a private, regular file. Callers keep the credential inside their transport. */
export async function assistantCredential<T>(
	directory: string,
	name: 'slack-bot-token' | 'slack-socket-token' | 'github-app-key.pem' | 'anthropic-api-key',
	use: (secret: string) => Promise<T>
): Promise<T> {
	let value: string;
	try {
		const file = await open(
			resolve(directory, name),
			constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
		);
		try {
			const info = await file.stat();
			if (
				!info.isFile() ||
				info.uid !== process.getuid?.() ||
				info.mode & 0o077 ||
				info.size > 64_000
			)
				throw new ProjectAssistantError('Assistant input refused.');
			value = (await file.readFile('utf8')).trim();
			if (!value) throw new ProjectAssistantError('Assistant input refused.');
		} finally {
			await file.close();
		}
	} catch {
		throw new ProjectAssistantError('No usable assistant credential file: ' + name);
	}
	return use(value);
}
