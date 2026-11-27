// @harness-uid u_gjkaxocajg
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { XDigestSenderConfig } from '../../../core/agents-providers/xDigestSend.types';
import type { SecretCommand } from './secretManagerToken.types';

/** Pulls one day's file over SSH. Not there yet, or unreachable, both mean "wait". */
export async function fetchOutbox(
	source: XDigestSenderConfig['source'],
	day: string,
	execute: SecretCommand = async (command, args) =>
		(await promisify(execFile)(command, args, { timeout: 60_000, maxBuffer: 256 * 1024 })).stdout
): Promise<string | undefined> {
	const options = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20'];
	const read = `cat -- ${source.directory}/${day}.json`;
	return execute('ssh', [...options, source.host, read]).catch(() => undefined);
}
