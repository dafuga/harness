// @harness-uid u_wznbhpkkv5
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { XDigestSenderConfig } from '../../../core/agents-providers/xDigestSend.types';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { SecretCommand } from './secretManagerToken.types';

/**
 * Reads the token from Secret Manager into this process only. It is never written anywhere, and a
 * failure reports none of the command's output.
 */
export async function secretManagerToken(
	secret: XDigestSenderConfig['slack']['secret'],
	execute: SecretCommand = async (command, args) =>
		(await promisify(execFile)(command, args, { timeout: 60_000, maxBuffer: 4096 })).stdout
): Promise<string> {
	const args = ['secrets', 'versions', 'access', 'latest'];
	args.push(`--secret=${secret.name}`, `--project=${secret.project}`);
	try {
		return (await execute('gcloud', args)).trim();
	} catch {
		throw new ExpectedCliError(`Could not read ${secret.name} with gcloud.`);
	}
}
