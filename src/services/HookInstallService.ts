import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import { chainedSuffix, enabledFile, hookScript, managedHook } from '../utils/hookScript';

export interface HookStatus {
	/** The wrapper is present in the hooks directory. */
	installed: boolean;
	/** This worktree opted in, so the wrapper runs Harness here. */
	enabled: boolean;
	stage: 'pre-push';
	hooksDirectory: string;
	/** A hook that was there before is kept and runs first. */
	chained: boolean;
	limitations: string[];
}

const stage = 'pre-push';
const limitations = [
	'`git push --no-verify` skips the hook; only CI checks every push.',
	'The hooks directory is shared: other worktrees of this repository run the hook only after `harness hooks install` is run there.',
	'Only pushes of branches are checked; tags and deletions are not.',
	'Nothing runs before a commit: a commit that does not exist yet cannot be verified exactly.'
];

/**
 * Installs the opt-in pre-push hook without disturbing what is there: an existing hook is kept
 * and chained, the wrapper acts only in worktrees that opted in, and uninstalling restores the
 * hooks directory byte for byte.
 */
export class HookInstallService {
	private readonly git: GitAdapter;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	async status(): Promise<HookStatus> {
		const { hook, hooks, enabled } = await this.paths();
		const text = await readFile(hook, 'utf8').catch(() => '');
		return {
			installed: managedHook(text),
			enabled: existsSync(enabled),
			stage,
			hooksDirectory: hooks,
			chained: existsSync(`${hook}${chainedSuffix}`),
			limitations
		};
	}

	/** `command` is how this worktree starts Harness, for example `harness` or `bun run dev --`. */
	async install(command: string): Promise<HookStatus> {
		const { hook, hooks, enabled } = await this.paths();
		await mkdir(hooks, { recursive: true });
		const existing = await readFile(hook, 'utf8').catch(() => undefined);
		if (existing !== undefined && !managedHook(existing))
			await rename(hook, `${hook}${chainedSuffix}`);
		await writeFile(hook, hookScript(stage));
		await chmod(hook, 0o755);
		await writeFile(enabled, `${command.trim()}\n`);
		return this.status();
	}

	/** Turns the hook off here; the wrapper goes, and the old hook returns, once no worktree uses it. */
	async uninstall(): Promise<HookStatus> {
		const { hook, enabled, common } = await this.paths();
		await rm(enabled, { force: true });
		const others = await readdir(join(common, 'worktrees')).catch(() => []);
		const used = [common, ...others.map((name) => join(common, 'worktrees', name))].some((path) =>
			existsSync(join(path, enabledFile))
		);
		const text = await readFile(hook, 'utf8').catch(() => '');
		if (!used && managedHook(text)) {
			await rm(hook, { force: true });
			if (existsSync(`${hook}${chainedSuffix}`)) await rename(`${hook}${chainedSuffix}`, hook);
		}
		return this.status();
	}

	/** Hooks that live inside the working tree belong to another tool and are left alone. */
	private async paths(): Promise<{ hook: string; hooks: string; enabled: string; common: string }> {
		const absolute = (path: string) => (isAbsolute(path) ? path : resolve(this.root, path));
		const hooks = absolute(await this.git.run(['rev-parse', '--git-path', 'hooks']));
		const top = await this.git.run(['rev-parse', '--show-toplevel']);
		const common = absolute(await this.git.run(['rev-parse', '--git-common-dir']));
		const inside = relative(top, hooks);
		if (!inside.startsWith('..') && !isAbsolute(inside) && !hooks.startsWith(`${common}/`)) {
			return fail(
				`core.hooksPath points into the working tree (${inside}), where another tool manages hooks; ` +
					'add `harness hooks run pre-push` to that hook instead.'
			);
		}
		const own = absolute(await this.git.run(['rev-parse', '--absolute-git-dir']));
		return { hook: join(hooks, stage), hooks, enabled: join(own, enabledFile), common };
	}
}
