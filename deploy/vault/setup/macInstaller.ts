import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import common from './common.sh' with { type: 'text' };
import macos from './macos.sh' with { type: 'text' };
import type { VaultAction, VaultSetupBridge } from './macInstaller.types';

const execute = promisify(execFile);
const installer = [common, macos, 'vault_main "$@"'].join('\n');
const isolated = { cwd: '/', env: {} };

/** Only the fixed installer and whitelisted action cross the macOS authorization boundary. */
const approval = [
	'on run argv',
	'set payload to quoted form of item 1 of argv',
	'set verb to quoted form of item 2 of argv',
	'set reason to "Allow Vault to set up its isolated local executor."',
	'if item 2 of argv is "remove" then set reason to "Allow Vault to remove its isolated local executor and archive its private data."',
	'do shell script "/usr/bin/env -i /bin/bash -c " & payload & " vault " & verb with prompt reason with administrator privileges',
	'end run'
].join('\n');

export function macVaultInstaller(): VaultSetupBridge {
	let active = false;
	return {
		async status() {
			const result = await execute('/bin/bash', ['-c', installer, 'vault', 'status'], isolated);
			return result.stdout.trim();
		},
		async run(action) {
			if (action !== 'setup' && action !== 'remove') return 'Unknown Vault operation.';
			if (active) return 'Another Vault operation is already running.';
			active = true;
			try {
				await execute('/usr/bin/osascript', ['-e', approval, installer, action], isolated);
				return null;
			} catch (error) {
				return installerError(error, action);
			} finally {
				active = false;
			}
		}
	};
}

function installerError(error: unknown, action: VaultAction): string {
	const stderr = (error as { stderr?: string } | null)?.stderr ?? '';
	if (stderr.includes('(-128)')) return 'Administrator approval was canceled.';
	const step = stderr.match(/Vault (?:setup|remove) failed at [a-z]+[.][^\r\n]{0,240}/)?.[0];
	return (
		step ??
		(stderr.includes('Another Vault operation is already running.')
			? 'Another Vault operation is already running.'
			: 'Vault ' + action + ' could not finish. Try again to resume.')
	);
}
