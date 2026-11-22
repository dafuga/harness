// @harness-uid u_hcdv6alnyy
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { Command } from 'commander';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type {
	ProviderSignInDeps,
	ProviderSignInSpec,
	ProviderSignInStatus,
	SignInProviderId
} from './ProviderSignInCommand.types';

/** Fixed official sign-in commands; provider ids outside this map never reach a process. */
const SIGN_IN_SPECS: Readonly<Record<SignInProviderId, ProviderSignInSpec>> = {
	chatgpt: { label: 'Codex CLI', command: 'codex', args: ['login'] },
	claude: { label: 'Claude CLI', command: 'claude', args: ['auth', 'login'] },
	gemini: { label: 'Gemini CLI', command: 'gemini', args: [] }
};

/** Reports local sign-in availability and dispatches the recognized official provider command. */
export class ProviderSignInCommand {
	constructor(
		private readonly deps: ProviderSignInDeps = {
			locate: installedProvider,
			launch: launchProvider
		}
	) {}

	register(program: Command): void {
		const group = program
			.command('provider')
			.description('Open the installed provider sign-in tools.');
		group
			.command('status <provider>')
			.description('Report whether the local provider tool is available.')
			.option('--json')
			.action((provider: string, options: { json?: boolean }) => {
				const status = this.status(provider);
				console.log(
					options.json
						? JSON.stringify(status)
						: `${status.command} is ${status.available ? 'available' : 'missing'}.`
				);
			});
		group
			.command('sign-in <provider>')
			.description('Open the official provider tool in the local terminal.')
			.action(async (provider: string) => {
				process.exitCode = await this.run(provider);
			});
	}

	status(provider: string): ProviderSignInStatus {
		const spec = this.spec(provider);
		return {
			provider,
			command: spec.command,
			available: this.deps.locate(spec.command) !== null
		};
	}

	async run(provider: string): Promise<number> {
		const spec = this.spec(provider);
		const executable = this.deps.locate(spec.command);
		if (executable === null) throw new ExpectedCliError(`${spec.label} is not installed.`);
		try {
			return await this.deps.launch(executable, spec.args);
		} catch {
			throw new ExpectedCliError(`Could not start ${spec.label}.`);
		}
	}

	private spec(provider: string): ProviderSignInSpec {
		if (!Object.hasOwn(SIGN_IN_SPECS, provider)) {
			throw new ExpectedCliError('Unknown sign-in provider.');
		}
		return SIGN_IN_SPECS[provider as SignInProviderId];
	}
}

function installedProvider(command: string): string | null {
	const home = homedir();
	const local = ['.local/bin', '.npm-global/bin', '.bun/bin'].map((directory) =>
		join(home, directory)
	);
	const search = [process.env.PATH, ...local].filter(Boolean).join(delimiter);
	const executable = Bun.which(command, { PATH: search });
	return executable && !/\.(bat|cmd)$/i.test(executable) ? executable : null;
}

function launchProvider(executable: string, args: readonly string[]): Promise<number> {
	const env = Object.fromEntries(
		[
			'PATH',
			'HOME',
			'USER',
			'LOGNAME',
			'USERPROFILE',
			'SystemRoot',
			'APPDATA',
			'LOCALAPPDATA',
			'TMPDIR',
			'TEMP',
			'TMP',
			'LANG',
			'LC_ALL',
			'LC_CTYPE',
			'TERM',
			'COLORTERM',
			'DISPLAY',
			'WAYLAND_DISPLAY',
			'XDG_RUNTIME_DIR',
			'DBUS_SESSION_BUS_ADDRESS'
		].map((key) => [key, process.env[key]])
	);
	const child = spawn(executable, [...args], { cwd: homedir(), env, stdio: 'inherit' });
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', (code, signal) => {
			const interrupted: Record<string, number> = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };
			resolve(code ?? interrupted[signal ?? ''] ?? 1);
		});
	});
}
