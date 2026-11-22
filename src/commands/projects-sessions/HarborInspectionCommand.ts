// @harness-uid u_yga4vj5ueo
import { execFile } from 'node:child_process';
import { extname, isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { ExpectedCliError } from '../../core/development-tooling/errors';

const execute = promisify(execFile);
const RUNTIME_ENV = [
	'PATH',
	'HOME',
	'USERPROFILE',
	'SystemRoot',
	'APPDATA',
	'LOCALAPPDATA',
	'TMPDIR',
	'TMP',
	'TEMP',
	'LANG',
	'LC_ALL',
	'HARBOR_HOME'
];

export class HarborInspectionCommand {
	register(program: Command): void {
		const harbor = program
			.command('harbor')
			.description('Inspect Harbor using its installed CLI package.');
		harbor
			.command('version')
			.description('Show the installed Harbor CLI version.')
			.action(() => this.run(['--version']));
		harbor
			.command('chain')
			.description('Inspect a Harbor chain.')
			.command('info')
			.description('Read chain information as JSON.')
			.option('-u, --url <url>', 'Harbor testnet RPC URL.')
			.option('--json', 'Print JSON (the default).')
			.action((options: { url?: string }) =>
				this.run(['chain', 'info', '--json', ...rpcArgs(options.url)])
			);
		harbor
			.command('agent')
			.description('Inspect Harbor agents.')
			.command('status')
			.description('Report local agent service status.')
			.option('--config <path>', 'Harbor agent config path.')
			.action((options: { config?: string }) =>
				this.run(['agent', 'status', ...(options.config ? ['--config', options.config] : [])])
			);
	}

	private async run(args: string[]): Promise<void> {
		const entry = process.env.HARNESS_HARBOR_CLI_PATH;
		if (!entry || !isAbsolute(entry) || !['.js', '.cjs', '.mjs'].includes(extname(entry))) {
			throw new ExpectedCliError(
				'Set HARNESS_HARBOR_CLI_PATH to the installed Harbor package entry.'
			);
		}
		const node = unsetIfEmpty(process.env.HARNESS_HARBOR_NODE_PATH) ?? Bun.which('node');
		if (!node || !isAbsolute(node) || /\.(?:bat|cmd)$/i.test(node)) {
			throw new ExpectedCliError('Set HARNESS_HARBOR_NODE_PATH to an absolute Node executable.');
		}
		const env = Object.fromEntries(RUNTIME_ENV.map((key) => [key, process.env[key]]));
		try {
			const result = await execute(node, [entry, ...args], {
				env,
				windowsHide: true,
				timeout: 3000,
				killSignal: 'SIGKILL',
				maxBuffer: 1024 * 1024
			});
			console.log(result.stdout.replace(/\r?\n$/, ''));
		} catch (error) {
			const code = (error as { code?: unknown }).code;
			if (typeof code === 'number') {
				console.error('The installed Harbor CLI reported an inspection error.');
				process.exitCode = code;
				return;
			}
			throw new ExpectedCliError('Could not inspect Harbor through its installed CLI.');
		}
	}
}

function rpcArgs(raw: string | undefined): string[] {
	const value = unsetIfEmpty(raw) ?? unsetIfEmpty(process.env.HARBOR_API_URL);
	if (!value) return [];
	try {
		const url = new URL(value);
		if (
			['http:', 'https:'].includes(url.protocol) &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash
		)
			return ['--url', value];
	} catch {
		// Keep connection settings and any embedded values out of diagnostics.
	}
	throw new ExpectedCliError('Use a Harbor RPC URL without credentials, a query or a fragment.');
}

// Empty values count as unset, matching the earlier `||` fallback.
function unsetIfEmpty(value: string | undefined): string | undefined {
	return value === '' ? undefined : value;
}
