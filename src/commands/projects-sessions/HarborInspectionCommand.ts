// @harness-uid u_yga4vj5ueo
import { execFile } from 'node:child_process';
import { extname, isAbsolute, resolve } from 'node:path';
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

type PublishOptions = { commit: string; artifact: string; profile: string; approve?: string };

export class HarborInspectionCommand {
	register(program: Command): void {
		const harbor = program
			.command('harbor')
			.description('Use Harbor capabilities from its installed CLI and SDK.');
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
		harbor
			.command('publish <project>')
			.description(
				'Review a verified Harbor testnet release, or publish it with the matching approval digest.'
			)
			.requiredOption('--commit <sha>', 'Full verified source commit.')
			.requiredOption('--artifact <path>', 'Relative .harborapp output path.')
			.requiredOption('--profile <file>', 'Trusted local Harbor testnet profile.')
			.option('--approve <digest>', 'Approval digest from the matching review.')
			.action((project: string, options: PublishOptions) =>
				this.run(
					[
						'publish',
						project,
						'--commit',
						options.commit,
						'--artifact',
						options.artifact,
						'--profile',
						options.profile,
						...(options.approve === undefined ? [] : ['--approve', options.approve])
					],
					true
				)
			);
	}

	private async run(args: string[], publish = false): Promise<void> {
		const entryVariable = publish ? 'HARNESS_HARBOR_APP_SDK_PATH' : 'HARNESS_HARBOR_CLI_PATH';
		const entry = process.env[entryVariable];
		if (!entry || !isAbsolute(entry) || !['.js', '.cjs', '.mjs'].includes(extname(entry))) {
			throw new ExpectedCliError(`Set ${entryVariable} to the installed Harbor package entry.`);
		}
		const node = process.env.HARNESS_HARBOR_NODE_PATH || Bun.which('node');
		if (!node || !isAbsolute(node) || /\.(?:bat|cmd)$/i.test(node)) {
			throw new ExpectedCliError('Set HARNESS_HARBOR_NODE_PATH to an absolute Node executable.');
		}
		const env = Object.fromEntries(RUNTIME_ENV.map((key) => [key, process.env[key]]));
		if (publish) {
			env.HARNESS_CLI_PATH = resolve(process.argv[1]);
			env.HARNESS_HARBOR_CLI_PATH = process.env.HARNESS_HARBOR_CLI_PATH;
			env.HARNESS_HARBOR_NODE_PATH = node;
		}
		try {
			const child = execute(node, [entry, ...args], {
				env,
				windowsHide: true,
				timeout: publish ? 780_000 : 3000,
				killSignal: publish ? 'SIGTERM' : 'SIGKILL',
				maxBuffer: 1024 * 1024
			});
			const result = await (publish ? waitForPublication(child) : child);
			console.log(result.stdout.replace(/\r?\n$/, ''));
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (typeof code === 'number') {
				console.error(
					publish
						? 'Harbor could not complete publication. Check the testnet profile and local verification record.'
						: 'The installed Harbor CLI reported an inspection error.'
				);
				process.exitCode = code;
				return;
			}
			throw new ExpectedCliError(
				publish
					? 'Harbor publication stopped.'
					: 'Could not inspect Harbor through its installed CLI.'
			);
		}
	}
}

async function waitForPublication(child: ReturnType<typeof execute>) {
	const cancel = () => child.child.kill('SIGTERM');
	process.on('SIGINT', cancel);
	process.on('SIGTERM', cancel);
	try {
		return await child;
	} finally {
		process.off('SIGINT', cancel);
		process.off('SIGTERM', cancel);
	}
}

function rpcArgs(raw: string | undefined): string[] {
	const value = raw || process.env.HARBOR_API_URL;
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
