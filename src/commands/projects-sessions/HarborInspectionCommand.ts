// @harness-uid u_yga4vj5ueo
import { execFile } from 'node:child_process';
import { extname, isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { PublishOptions, RunMode } from './HarborInspectionCommand.types';
import { HARBOR_RUN_PROFILES } from './harborRunProfiles';
import { registerHarborAppTools } from './registerHarborAppTools';

const execute = promisify(execFile);
const CANCEL_GRACE_MS = 35_000;
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
		const harbor = program.command('harbor');
		harbor.description('Use Harbor capabilities from its installed CLI and SDK.');
		this.registerInspection(harbor);
		this.registerRuntime(harbor);
		this.registerPublish(harbor);
		registerHarborAppTools(harbor, (args, mode) => this.run(args, mode));
	}

	private registerInspection(harbor: Command): void {
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

	private registerRuntime(harbor: Command): void {
		const service = harbor.command('service').description('Inspect Harbor runtime services.');
		service
			.command('status [service]')
			.description('Report Harbor service status as JSON.')
			.option('--system', 'Inspect the system service manager.')
			.action((name: string | undefined, options: { system?: boolean }) => {
				const args = ['service', 'status', '--json'];
				if (name !== undefined) args.push(name);
				if (options.system) args.push('--system');
				return this.run(args);
			});
		harbor
			.command('doctor')
			.description('Diagnose the Harbor runtime as JSON.')
			.option('--service <name>', 'Harbor service to diagnose.')
			.option('--config <path>', 'Harbor runtime config path.')
			.option('--strict', 'Fail when diagnostics report problems.')
			.action((options: { service?: string; config?: string; strict?: boolean }) => {
				const args = ['doctor', '--json'];
				if (options.service !== undefined) args.push('--service', options.service);
				if (options.config !== undefined) args.push('--config', options.config);
				if (options.strict) args.push('--strict');
				return this.run(args);
			});
	}

	private registerPublish(harbor: Command): void {
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
				this.run(publishArgs(project, options), 'publish')
			);
	}

	private async run(args: string[], mode: RunMode = 'inspect'): Promise<void> {
		const profile = HARBOR_RUN_PROFILES[mode];
		const entry = installedEntry(profile.sdk);
		const node = nodeExecutable();
		try {
			const child = execute(node, [entry, ...args], {
				env: runtimeEnv(mode, node),
				windowsHide: true,
				timeout: profile.timeoutMs,
				killSignal: profile.sdk ? 'SIGTERM' : 'SIGKILL',
				maxBuffer: 1024 * 1024
			});
			const result = await (profile.sdk ? waitForCancellable(child) : child);
			console.log(String(result.stdout).replace(/\r?\n$/, ''));
		} catch (error) {
			const { code, stdout } = error as { code?: unknown; stdout?: string };
			if (typeof code === 'number') {
				if (isStrictDiagnostic(args, code, stdout)) console.log(stdout.trimEnd());
				else console.error(profile.failure);
				process.exitCode = code;
				return;
			}
			throw new ExpectedCliError(profile.stopped);
		}
	}
}

function isStrictDiagnostic(args: string[], code: number, stdout?: string): stdout is string {
	return args[0] === 'doctor' && args.at(-1) === '--strict' && code === 1 && Boolean(stdout);
}
function publishArgs(project: string, options: PublishOptions): string[] {
	const { commit, artifact, profile, approve } = options;
	const verification = ['--commit', commit, '--artifact', artifact, '--profile', profile];
	if (approve !== undefined) verification.push('--approve', approve);
	return ['publish', project, ...verification];
}

function installedEntry(sdk: boolean): string {
	const variable = sdk ? 'HARNESS_HARBOR_APP_SDK_PATH' : 'HARNESS_HARBOR_CLI_PATH';
	const entry = process.env[variable];
	if (!entry || !isAbsolute(entry) || !['.js', '.cjs', '.mjs'].includes(extname(entry))) {
		throw new ExpectedCliError(`Set ${variable} to the installed Harbor package entry.`);
	}
	return entry;
}

function nodeExecutable(): string {
	const node = unsetIfEmpty(process.env.HARNESS_HARBOR_NODE_PATH) ?? Bun.which('node');
	if (!node || !isAbsolute(node) || /\.(?:bat|cmd)$/i.test(node)) {
		throw new ExpectedCliError('Set HARNESS_HARBOR_NODE_PATH to an absolute Node executable.');
	}
	return node;
}

function runtimeEnv(mode: RunMode, node: string): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = Object.fromEntries(
		RUNTIME_ENV.map((key) => [key, process.env[key]])
	);
	if (mode === 'inspect') return env;
	const sdkEnv = { ...env, HARNESS_CLI_PATH: resolve(process.argv[1]) };
	if (mode !== 'publish') return sdkEnv;
	return {
		...sdkEnv,
		HARNESS_HARBOR_CLI_PATH: process.env.HARNESS_HARBOR_CLI_PATH,
		HARNESS_HARBOR_NODE_PATH: node
	};
}

async function waitForCancellable(child: ReturnType<typeof execute>) {
	let grace: ReturnType<typeof setTimeout> | undefined;
	const cancel = (signal: 'SIGINT' | 'SIGTERM') => {
		child.child.kill(signal);
		grace ??= setTimeout(() => child.child.kill('SIGKILL'), CANCEL_GRACE_MS);
	};
	const onInterrupt = () => cancel('SIGINT');
	const onTerminate = () => cancel('SIGTERM');
	process.on('SIGINT', onInterrupt);
	process.on('SIGTERM', onTerminate);
	try {
		return await child;
	} finally {
		process.off('SIGINT', onInterrupt);
		process.off('SIGTERM', onTerminate);
		clearTimeout(grace);
	}
}

// Empty values count as unset, matching the earlier `||` fallback.
function unsetIfEmpty(value: string | undefined): string | undefined {
	return value === '' ? undefined : value;
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
