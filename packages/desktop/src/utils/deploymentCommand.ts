import { cliEnvironment } from './cliEnvironment';
import { killOwnedProcess } from './cliProcess';
import { spawn } from 'node:child_process';
import type { DeployCommand } from '../models/Deployment.types';
/** No shell, inherited Cloudflare credentials, or credential-bearing failure output. */
export async function deploymentCommand(command: DeployCommand): Promise<string> {
	const env = cliEnvironment();
	return new Promise((resolve, reject) => {
		const child = spawn(command.args[0], command.args.slice(1), {
			cwd: command.cwd,
			detached: process.platform !== 'win32',
			env: { ...env, ...command.env, CI: 'true' },
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let output = '';
		child.stdout.on('data', (chunk) => {
			output = (output + String(chunk)).slice(-1000000);
		});
		child.stderr.on('data', () => {});
		child.on('error', () => {
			clearTimeout(timer);
			reject(new Error('Deployment command could not start.'));
		});
		const timer = setTimeout(
			() => {
				killOwnedProcess(child.pid);
			},
			20 * 60 * 1000
		);
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code !== 0)
				reject(
					new Error(`Deployment step ${command.args.slice(0, 3).join(' ')} failed (${code}).`)
				);
			else resolve(output);
		});
	});
}
