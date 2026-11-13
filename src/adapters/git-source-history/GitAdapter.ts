// @harness-uid u_pghy4246hw
import type { GitRunOptions, GitResult } from './GitAdapter.types';
import { BoundedCommandAdapter } from '../execution-runtimes/BoundedCommandAdapter';

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
		return new BoundedCommandAdapter().run('git', args, {
			...options,
			cwd: this.root,
			maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
			env: { ...options.env, GIT_TERMINAL_PROMPT: '0' }
		});
	}

	async isRepository(): Promise<boolean> {
		return (await this.attempt(['rev-parse', '--is-inside-work-tree'])) === 'true';
	}
}

export type { GitRunOptions, GitResult } from './GitAdapter.types';
