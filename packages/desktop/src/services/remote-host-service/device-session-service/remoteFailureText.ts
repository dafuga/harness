import { homedir } from 'node:os';
import { RemoteFailure, remoteErrorMessages } from '../../../../../remote/src/index';
import type { RemoteError } from '../../../../../remote/src/index';

const hidden = '…';

const path = /(^|[\s'"(=:])\/\S|[A-Za-z]:\\/;

/**
 * What a phone is told when a request fails. The desktop's own words pass; anything that names a
 * project folder, the home directory or any other path becomes the generic sentence.
 */
export function remoteFailureText(error: unknown, roots: string[] = []): RemoteError {
	if (error instanceof RemoteFailure) return { code: error.code, message: error.message };
	let text = error instanceof Error ? error.message : '';
	for (const root of [...roots, homedir()].filter(Boolean)) text = text.split(root).join(hidden);
	const safe = text.length > 0 && text.length <= 300 && !text.includes(hidden) && !path.test(text);
	return { code: 'failed', message: safe ? text : remoteErrorMessages.failed };
}
