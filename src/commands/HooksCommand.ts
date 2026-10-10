import type { Command } from 'commander';
import { manageHooks, renderHookOutcome, renderHooks, runHook } from '../workflows/runHooks';

interface Flags {
	json?: boolean;
	command?: string;
}

const help = {
	install: 'Enable the pre-push hook for this worktree, keeping any existing hook.',
	uninstall: 'Disable the hook here and restore the hooks directory when nobody uses it.',
	status: 'Show whether the hook is installed and enabled, and what it cannot do.'
};

async function standardInput(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

export function registerHooksCommand(program: Command): Command {
	const hooks = program
		.command('hooks')
		.description('Opt-in local Git hook that requires a passing verification before a push.');
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
		.command('run <stage>')
		.description('Run the gate for a hook stage; called by the installed hook.')
		.action(async (stage: string) => {
			const outcome = await runHook(stage, await standardInput());
			for (const line of renderHookOutcome(outcome)) console.error(line);
			if (outcome.blocked.length > 0) process.exitCode = 1;
		});
	return hooks;
}
