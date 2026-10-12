import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import { CommitMessageService } from '../services/CommitMessageService';
import { HookInstallService, type HookStatus } from '../services/HookInstallService';
import { HookRunService, type HookOutcome } from '../services/HookRunService';

type Action = 'install' | 'uninstall' | 'status';

/** Variables Git sets for a hook; with them, commands run by a check would act on this repository. */
const gitHookVariables = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX'];

async function repository(root = process.cwd()): Promise<string> {
	const absolute = resolve(root);
	if (!(await new GitAdapter(absolute).isRepository())) {
		return fail('harness hooks needs a Git working tree.');
	}
	return absolute;
}

/** Installs, removes or reports the opt-in hooks of this worktree. */
export async function manageHooks(
	action: Action,
	command = 'harness',
	root?: string
): Promise<HookStatus> {
	const service = new HookInstallService(await repository(root));
	if (action === 'install') return service.install(command);
	return action === 'uninstall' ? service.uninstall() : service.status();
}

/** Runs the gate for one hook stage with the input Git gave the hook. */
export async function runHook(stage: string, input: string, root?: string): Promise<HookOutcome> {
	if (stage !== 'pre-push')
		return fail(`Unsupported hook stage "${stage}"; pre-push and commit-msg are offered.`);
	for (const name of gitHookVariables) delete process.env[name];
	return new HookRunService(await repository(root)).prePush(input);
}

/**
 * The commit-msg gate: what is wrong with the message in the file Git gave the hook. The
 * variables Git set stay as they are, because the index they name is the commit in the making.
 */
export async function checkMessage(file: string | undefined, root?: string): Promise<string[]> {
	if (!file) return fail('The commit-msg hook is given the path of the message file.');
	return new CommitMessageService(await repository(root)).written(file);
}

export function renderHooks(status: HookStatus): string {
	const installed = status.installed ? 'installed' : 'not installed';
	const enabled = status.enabled ? 'enabled for this worktree' : 'not enabled for this worktree';
	const chained = status.chained ? ' An existing hook is kept and runs first.' : '';
	const message = status.stages.find((stage) => stage.stage === 'commit-msg');
	const measured = message?.installed ? 'installed' : 'not installed';
	return [
		`The ${status.stage} hook is ${installed} in ${status.hooksDirectory} and ${enabled}.${chained}`,
		`The commit-msg hook is ${measured}; it measures a commit message where the repository declares the writing limits.`,
		'Limits of a local hook:',
		...status.limitations.map((limit) => `  - ${limit}`)
	].join('\n');
}

export function renderHookOutcome(outcome: HookOutcome): string[] {
	const short = (id: string) => id.slice(0, 12);
	return [
		...outcome.verified.map(
			(item) => `harness: ${short(item.commit)} is verified by ${short(item.record)}`
		),
		...outcome.blocked.flatMap((item) => [
			`harness: push blocked: ${short(item.commit)} is not verified`,
			...item.failures.map((failure) => `  ${failure}`)
		])
	];
}
