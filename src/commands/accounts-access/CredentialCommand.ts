// @harness-uid u_ydbpwntlfp
import type { Command } from 'commander';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { VaultBrokerClientAdapter } from '../../adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultSealAdapter } from '../../adapters/accounts-access/VaultSealAdapter';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { vaultPasswordAction } from '../../validators/accounts-access/VaultWireValidator';
import { runCredentialRequest } from '../../workflows/accounts-access/runCredentialRequest';
import { serveCredentialBroker } from '../../workflows/accounts-access/serveCredentialBroker';
import type { CredentialCommandOptions as Options } from './CredentialCommand.types';
import { CredentialRecipeCommand } from './CredentialRecipeCommand';

const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
const calls = {
	status: 'Read a request; the receipt comes from HARNESS_VAULT_RECEIPT.',
	cancel: 'Cancel a request; the receipt comes from HARNESS_VAULT_RECEIPT.',
	[vaultPasswordAction]:
		'Run one approved password request; the receipt comes from HARNESS_VAULT_RECEIPT.',
	attach: 'Get the one-time CDP endpoint of a lease.',
	finish: 'End a lease and print its teardown plan.'
} as const;
const fields = ['item', 'session', 'project', 'environment', 'host', 'reason'] as const;

/** `harness credential`: the Credential Vault broker, requests and CDP leases. */
export class CredentialCommand {
	private readonly recipes = new CredentialRecipeCommand();
	private credential: Command | null = null;

	register(program: Command): void {
		const credential = program
			.command('credential')
			.description('Request Vault logins and generated passwords, and check site recipes.')
			.option('--socket <path>', 'Broker Unix socket; defaults to HARNESS_VAULT_SOCKET.');
		this.credential = credential;
		credential
			.command('serve')
			.description('Run the broker on its owner-only Unix socket.')
			.requiredOption('--state <dir>', 'Private state directory for the audit journal.')
			.requiredOption('--trust <file>', 'Enrolled phone devices JSON.')
			.requiredOption('--origin <url>', 'Approval origin the phones sign for.')
			.option('--password-config <file>', 'Operator configuration for private password execution.')
			.action(async (options: Options) => this.serve(options));
		this.registerRequest(credential);
		for (const [name, description] of Object.entries(calls)) {
			const command = credential.command(name + ' <id>').description(description);
			if (name === 'attach' || name === 'finish')
				command.requiredOption('--session <name>', 'Requesting session.');
			command.action(async (id: string, options: Options) =>
				print(await this.call(name, id, options))
			);
		}
		this.recipes.register(credential);
	}

	private registerRequest(credential: Command): void {
		const request = credential
			.command('request <recipe> <action>')
			.description('Preflight a reviewed recipe and file a request for phone approval.');
		this.recipes
			.options(request)
			.requiredOption('--item <id>', 'Tracker item the request serves.')
			.requiredOption('--session <name>', 'Requesting session name.')
			.requiredOption('--project <id>', 'Harness project id.')
			.requiredOption('--environment <id>', 'Environment id.')
			.requiredOption('--host <id>', 'Executor host id.')
			.option('--runner-key <key>', 'Login runner X25519 public key, base64url.')
			.requiredOption('--reason <text>', 'Why the session needs this login.')
			.option('--account <alias>', 'Expected recipe account alias.')
			.option('--ready <kinds>', 'Comma-separated method kinds that can run now.')
			.action(async (recipe: string, action: string, options: Options) => {
				const runnerKey = options.runnerKey ?? this.generationRunnerKey(action);
				const given = Object.fromEntries(fields.map((key) => [key, options[key] ?? ''])) as Record<
					(typeof fields)[number],
					string
				>;
				const ready = (options.ready ?? (action === vaultPasswordAction ? 'browser' : ''))
					.split(',')
					.filter(Boolean);
				const files = this.recipes.files(recipe, options);
				const socket = this.socket();
				print(
					await runCredentialRequest({
						...files,
						...given,
						runnerKey,
						action,
						account: options.account,
						ready,
						socket
					})
				);
			});
	}

	private generationRunnerKey(action: string): string {
		if (action !== vaultPasswordAction)
			throw new ExpectedCliError('Specify --runner-key for login requests.');
		return new VaultSealAdapter().runnerKey().publicKey;
	}

	private async serve(options: Options): Promise<void> {
		const served = await serveCredentialBroker({
			socket: this.socket(),
			state: resolve(options.state ?? ''),
			trust: resolve(options.trust ?? ''),
			origin: options.origin ?? '',
			passwordConfig: options.passwordConfig ? resolve(options.passwordConfig) : undefined,
			onTeardown: print
		});
		print({ listening: served.socket });
		await new Promise<void>((done) =>
			process.once('SIGTERM', () => void served.close().then(done))
		);
	}

	private call(name: string, id: string, options: Options): Promise<unknown> {
		const client = new VaultBrokerClientAdapter({
			socketPath: this.socket(),
			timeoutMs: name === vaultPasswordAction ? 210_000 : undefined
		});
		if (name === 'attach' || name === 'finish') {
			return client.call('/v1/session/' + name, { lease: id, session: options.session });
		}
		const receipt = process.env.HARNESS_VAULT_RECEIPT;
		if (!receipt) throw new ExpectedCliError('Set HARNESS_VAULT_RECEIPT to the request receipt.');
		return client.call('/v1/session/' + name, { requestId: id, receipt });
	}

	private socket(): string {
		const given = this.credential?.opts<Options>().socket;
		return resolve(
			given ??
				process.env.HARNESS_VAULT_SOCKET ??
				join(homedir(), '.harness', 'vault', 'broker.sock')
		);
	}
}
