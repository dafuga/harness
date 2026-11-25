// @harness-uid u_mucsxl7k4y
import { spawn } from 'node:child_process';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

/** The pinned native helper receives only private stdin and reports success by exit status. */
export async function storeKeychainPassword(
	helper: string,
	location: { keychain: string; service: string; account: string },
	password: Buffer
): Promise<void> {
	const { keychain, service, account } = location;
	await new Promise<void>((resolve, reject) => {
		const refused = () => reject(new ExpectedCliError('Keychain refused the new password entry.'));
		const child = spawn(helper, [keychain, service, account], {
			env: {},
			stdio: ['pipe', 'ignore', 'ignore'],
			timeout: 8_000,
			killSignal: 'SIGKILL'
		});
		child.stdin.on('error', refused);
		child.on('error', refused);
		child.once('close', (code) => (code === 0 ? resolve() : refused()));
		child.stdin.end(password);
	});
}
