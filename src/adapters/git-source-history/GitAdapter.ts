import { spawn } from 'node:child_process';

export interface GitRunOptions {
	input?: string | Buffer;
	env?: Record<string, string>;
}

export interface GitResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}

/** Runs git in one repository without changing global or repository configuration. */
export class GitAdapter {
	constructor(readonly root: string) {}

	/** Runs git and returns trimmed stdout, failing with stderr on a non-zero exit. */
	async run(args: string[], options: GitRunOptions = {}): Promise<string> {
		return (await this.bytes(args, options)).toString('utf8').trim();
	}

	async bytes(args: string[], options: GitRunOptions = {}): Promise<Buffer> {
		const result = await this.exec(args, options);
		if (result.code === 0) return result.stdout;
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
	}

	/** Runs git and returns undefined instead of failing, for existence probes. */
	async attempt(args: string[], options: GitRunOptions = {}): Promise<string | undefined> {
		const result = await this.exec(args, options);
		return result.code === 0 ? result.stdout.toString('utf8').trim() : undefined;
	}

	exec(args: string[], options: GitRunOptions = {}): Promise<GitResult> {
		const child = spawn('git', args, {
			cwd: this.root,
			env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...options.env },
			stdio: 'pipe'
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.stdin.on('error', () => undefined);
		child.stdin.end(options.input);
		return new Promise((resolve, reject) => {
			child.once('error', reject);
			child.once('close', (code) =>
				resolve({
					code: code ?? 1,
					stdout: Buffer.concat(stdout),
					stderr: Buffer.concat(stderr).toString('utf8')
				})
			);
		});
	}

	async isRepository(): Promise<boolean> {
		return (await this.attempt(['rev-parse', '--is-inside-work-tree'])) === 'true';
	}
}
