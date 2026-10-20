import type { Command } from 'commander';
import { checkMessage, manageHooks, renderHookOutcome, renderHooks, runHook } from './runHooks';

interface Flags {
	json?: boolean;
	command?: string;
}

const help = {
	install: 'Enable the pre-push and commit-msg hooks for this worktree, keeping any existing hook.',
	uninstall: 'Disable the hooks here and restore the hooks directory when nobody uses them.',
	status: 'Show whether the hooks are installed and enabled, and what they cannot do.'
};

async function standardInput(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

/** Says what is wrong with a commit message and stops the commit; says nothing when it may be made. */
function refuseMessage(problems: string[]): void {
	if (problems.length === 0) return;
	console.error('harness: commit refused: the message does not keep the writing limits');
	for (const problem of problems) console.error(`  ${problem}`);
	process.exitCode = 1;
}

export function registerHooksCommand(program: Command): Command {
	const hooks = program
		.command('hooks')
		.description(
			'Opt-in local Git hooks: a passing verification before a push, and a short commit message.'
		);
	for (const action of ['install', 'uninstall', 'status'] as const) {
		const command = hooks.command(action).option('--json', 'Print structured results.');
		if (action === 'install') {
			command.option('--command <command>', 'How this worktree starts Harness.', 'harness');
		}
		command.description(help[action]).action(async (flags: Flags) => {
			const status = await manageHooks(action, flags.command);
			console.log(flags.json ? JSON.stringify(status, null, 2) : renderHooks(status));
		});
	}
	hooks
		.command('run <stage> [file]')
		.description('Run the gate for a hook stage; called by the installed hook.')
		.action(async (stage: string, file?: string) => {
			// A commit message arrives as a file: its gate reads no input, so it never waits for any.
			if (stage === 'commit-msg') {
				refuseMessage(await checkMessage(file));
				return;
			}
			const outcome = await runHook(stage, await standardInput());
			for (const line of renderHookOutcome(outcome)) console.error(line);
			if (outcome.blocked.length > 0) process.exitCode = 1;
		});
	return hooks;
}
