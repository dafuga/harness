import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

/** A pinned tool and its child environment. */
export interface PinnedTool {
	command: string;
	env: Record<string, string | undefined>;
}
/** Tool selection, including launch failures. */
export interface ToolAnswer {
	status: number | null;
	stdout: string;
	stderr: string;
	failed: boolean;
}
export type ToolRun = (
	command: string,
	args: string[],
	cwd: string,
	env: PinnedTool['env']
) => ToolAnswer;
export interface PinnedOptions {
	/** Read the nearest rust-toolchain.toml from this directory upwards. */
	cwd?: string;
	env?: Record<string, string | undefined>;
	run?: ToolRun;
}

const pin = 'rust-toolchain.toml';
const compiler = process.platform === 'win32' ? 'rustc.exe' : 'rustc';
const plain = /^[a-z][a-z0-9-]*$/;

function asked(command: string, args: string[], cwd: string, env: PinnedTool['env']): ToolAnswer {
	const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
	const failed = result.error !== undefined;
	return {
		status: result.status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
		failed
	};
}

function parseChannel(text: string, file: string): string {
	try {
		const parsed = Bun.TOML.parse(text) as { toolchain?: { channel?: unknown } };
		const channel = parsed.toolchain?.channel;
		if (typeof channel !== 'string' || !channel.trim() || channel !== channel.trim())
			throw new Error('toolchain.channel must be a nonempty string');
		return channel;
	} catch (error) {
		throw new Error(`Invalid ${file}: ${error instanceof Error ? error.message : error}`);
	}
}

/** A nearer malformed pin cannot fall back to an ancestor. */
function declaredChannel(cwd: string): string {
	let directory = resolve(cwd);
	if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory())
		throw new Error(`Rust toolchain directory does not exist: ${directory}`);
	while (true) {
		const file = join(directory, pin);
		let text: string;
		try {
			text = readFileSync(file, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			const parent = dirname(directory);
			if (parent === directory) throw new Error(`No ${pin} found from ${cwd}.`);
			directory = parent;
			continue;
		}
		return parseChannel(text, file);
	}
}

/** Select the pin and isolate child compilers from host overrides. */
export function pinnedToolchain(tool: string, options: PinnedOptions = {}): PinnedTool {
	const { cwd = process.cwd(), env = process.env, run = asked } = options;
	if (!plain.test(tool)) throw new Error(`"${tool}" is not a Rust tool name.`);
	const channel = declaredChannel(cwd);
	const childEnv = {
		...env,
		RUSTUP_TOOLCHAIN: channel,
		RUSTC: 'rustc',
		RUSTC_WRAPPER: '',
		RUSTC_WORKSPACE_WRAPPER: ''
	};
	const found = run('rustup', ['which', '--toolchain', channel, tool], cwd, childEnv);
	if (found.failed) {
		throw new Error(
			`rustup was not found, so the toolchain pinned in ${pin} cannot be selected. ` +
				'Install rustup; no other cargo or rustc is used in its place.'
		);
	}
	const path = found.stdout.trim();
	if (found.status !== 0) {
		throw new Error(
			`rustup could not select ${tool} of the toolchain pinned in ${pin}: ` +
				`${found.stderr.trim()}\nInstall it with "rustup toolchain install" in this directory.`
		);
	}
	if (!path) throw new Error(`rustup named no ${tool} for the toolchain pinned in ${pin}.`);
	const directory = dirname(path);
	return {
		command: path,
		env: {
			...childEnv,
			RUSTC: join(directory, compiler),
			PATH: `${directory}${delimiter}${env.PATH ?? ''}`,
			DYLD_LIBRARY_PATH: [join(directory, '..', 'lib'), env.DYLD_LIBRARY_PATH]
				.filter(Boolean)
				.join(delimiter)
		}
	};
}
