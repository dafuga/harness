// @harness-uid u_6dqpunlqnz
import { spawnSync } from 'node:child_process';
import type { Command } from 'commander';
import { ExpectedCliError } from '../../core/development-tooling/errors';

export class VaultSetupCommand {
	register(program: Command): void {
		const vault = program.command('vault').description('Manage the local Vault executor.');
		vault
			.command('setup')
			.description('Set up or repair this computer.')
			.action(() => this.run('setup'));
		vault
			.command('remove')
			.description('Remove Vault and preserve its private data.')
			.action(() => this.run('remove'));
		vault
			.command('status')
			.description('Read the local setup receipt.')
			.action(() => this.run('status'));
	}

	private async run(action: 'setup' | 'remove' | 'status'): Promise<void> {
		const platform = process.platform;
		if (platform !== 'darwin' && platform !== 'linux')
			throw new ExpectedCliError('Vault setup supports macOS and Linux.');
		const { vaultInstallerPayload } =
			await import('../../../deploy/vault/setup/vaultInstallerPayload');
		const script = vaultInstallerPayload(platform);
		const child = spawnSync('/bin/bash', ['-c', script, 'vault', action], {
			env: {},
			cwd: '/',
			stdio: 'inherit'
		});
		if (child.error) throw new ExpectedCliError('Could not start the Vault installer.');
		if (child.status !== 0) process.exitCode = child.status ?? 1;
	}
}
