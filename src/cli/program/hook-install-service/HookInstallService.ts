import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/GitAdapter';
import { fail } from '../../../core/errors';
import { chainedSuffix, hookStages, stageFile, type HookStage } from '../../../utils/hookScript';
import { hookScript, managedHook } from './hookScript';

/** One stage as this worktree has it: its shared wrapper, and whether it was asked for here. */
export interface HookStageStatus {
	stage: HookStage;
	installed: boolean;
	chained: boolean;
	/** This worktree opted into this stage; an opt-in for another stage does not count. */
	enabled: boolean;
}

export interface HookStatus {
	/** The pre-push wrapper is present in the hooks directory. */
	installed: boolean;
	/** This worktree opted into pushes, so the pre-push wrapper runs Harness here. */
	enabled: boolean;
	stage: 'pre-push';
	hooksDirectory: string;
	/** A pre-push hook that was there before is kept and runs first. */
	chained: boolean;
	/** Every stage Harness offers, each with its own wrapper, earlier hook and opt-in. */
	stages: HookStageStatus[];
	limitations: string[];
}

const limitations = [
	'`git push --no-verify` skips the hook; only CI checks every push.',
	'The hooks directory is shared: other worktrees of this repository run the hook only after `harness hooks install` is run there.',
	'A stage acts only where it was opted into: a worktree that ran `harness hooks install` under an earlier Harness keeps the stages it asked for then, until the command is run there again.',
	'Only pushes of branches are checked; tags and deletions are not.',
	'Before a commit exists only its message is measured: a commit that does not exist yet cannot be verified exactly.',
	'`git commit --no-verify` skips the commit-msg hook; verification measures the stored messages again.'
];

/**
 * Installs the opt-in pre-push and commit-msg hooks without disturbing what is there: an
 * existing hook is kept and chained, a wrapper acts only in worktrees that opted into its
 * stage, and uninstalling restores the hooks directory byte for byte.
 */
export class HookInstallService {
	private readonly git: GitAdapter;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	async status(): Promise<HookStatus> {
		const { hooks, own } = await this.paths();
		const stages = await Promise.all(
			hookStages.map(async (stage) => {
				const hook = join(hooks, stage);
				const text = await readFile(hook, 'utf8').catch(() => '');
				return {
					stage,
					installed: managedHook(text),
					chained: existsSync(hook + chainedSuffix),
					enabled: existsSync(join(own, stageFile(stage)))
				};
			})
		);
		const [push] = stages;
		return {
			installed: push.installed,
			enabled: push.enabled,
			stage: push.stage as 'pre-push',
			hooksDirectory: hooks,
			chained: push.chained,
			stages,
			limitations
		};
	}

	/**
	 * `command` is how this worktree starts Harness, for example `harness` or `bun run dev --`.
	 * It is recorded for each stage in a file of that stage, so only this worktree, and only
	 * the Harness that offers the stage, is ever started for it.
	 */
	async install(command: string): Promise<HookStatus> {
		const { hooks, own } = await this.paths();
		await mkdir(hooks, { recursive: true });
		for (const stage of hookStages) {
			const hook = join(hooks, stage);
			const existing = await readFile(hook, 'utf8').catch(() => undefined);
			if (existing !== undefined && !managedHook(existing))
				await rename(hook, hook + chainedSuffix);
			await writeFile(hook, hookScript(stage));
			await chmod(hook, 0o755);
			await writeFile(join(own, stageFile(stage)), `${command.trim()}\n`);
		}
		return this.status();
	}

	/**
	 * Turns the hooks off here. The wrapper of a stage goes, and the hook that was there returns,
	 * once no worktree asks for that stage; a stage another worktree still uses is left alone.
	 */
	async uninstall(): Promise<HookStatus> {
		const { hooks, own, common } = await this.paths();
		const others = await readdir(join(common, 'worktrees')).catch(() => []);
		const all = [common, ...others.map((name) => join(common, 'worktrees', name))];
		for (const stage of hookStages) {
			await rm(join(own, stageFile(stage)), { force: true });
			if (all.some((path) => existsSync(join(path, stageFile(stage))))) continue;
			const hook = join(hooks, stage);
			if (!managedHook(await readFile(hook, 'utf8').catch(() => ''))) continue;
			await rm(hook, { force: true });
			if (existsSync(hook + chainedSuffix)) await rename(hook + chainedSuffix, hook);
		}
		return this.status();
	}

	/** Hooks that live inside the working tree belong to another tool and are left alone. */
	private async paths(): Promise<{ hooks: string; own: string; common: string }> {
		const absolute = (path: string) => (isAbsolute(path) ? path : resolve(this.root, path));
		const hooks = absolute(await this.git.run(['rev-parse', '--git-path', 'hooks']));
		const top = await this.git.run(['rev-parse', '--show-toplevel']);
		const common = absolute(await this.git.run(['rev-parse', '--git-common-dir']));
		const inside = relative(top, hooks);
		if (!inside.startsWith('..') && !isAbsolute(inside) && !hooks.startsWith(`${common}/`)) {
			return fail(
				`core.hooksPath points into the working tree (${inside}), where another tool manages hooks; ` +
					'add `harness hooks run pre-push` and `harness hooks run commit-msg "$1"` to those hooks instead.'
			);
		}
		const own = absolute(await this.git.run(['rev-parse', '--absolute-git-dir']));
		return { hooks, own, common };
	}
}
