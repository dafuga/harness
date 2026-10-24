import type { Command } from 'commander';
import {
	TaskCompletionService,
	type TaskAudit,
	type TaskAuditInput
} from '../../services/verification-evidence/TaskCompletionService';
import {
	loopPaths,
	readLoop,
	validateLoopId
} from '../../workflows/development-tooling/loop-state/loopState';
import type { Flags } from './TaskCommand.types';
import { ModuleTaskCommand } from '../../commands/agents-providers/ModuleTaskCommand';
export type { Flags } from './TaskCommand.types';

/** The CLI delegates all completion decisions to the shared Harness service. */
export class TaskCommand {
	constructor(private readonly root = process.cwd()) {}
	async run(flags: Flags): Promise<TaskAudit> {
		const state = flags.loop
			? await readLoop(loopPaths(this.root, validateLoopId(flags.loop, 'Loop name')).state)
			: null;
		return new TaskCompletionService(this.root).check(taskInput(flags, state));
	}
}

function taskInput(
	flags: Flags,
	state: Awaited<ReturnType<typeof readLoop>> | null
): TaskAuditInput {
	const declared = state
		? { kind: state.completion?.kind, goal: state.goal, plan: state.completion?.plan }
		: flags;
	return {
		kind: declared.kind ?? 'coding',
		goal: declared.goal ?? '',
		plan: declared.plan,
		loop: flags.loop,
		units: taskUnits(flags.units)
	};
}

export function registerTaskCommand(program: Command): void {
	const task = program
		.command('task')
		.description('Committed module tasks, assigned workers and evidence-based completion.');
	new ModuleTaskCommand().register(task);
	task
		.command('check')
		.option('--loop <name>', 'Audit the declared loop task.')
		.option('--kind <kind>', 'coding or planning.', 'coding')
		.option('--goal <text>', 'What the task must accomplish.')
		.option('--plan <path>', 'Committed project-relative plan to inspect.')
		.option('--units <ids>', 'Required unit ids, separated by commas.')
		.option('--json', 'Print the stored audit.')
		.description(
			'Run the final heuristic and evidence audit; fail closed on missing or stale proof.'
		)
		.action(async (flags: Flags) => {
			const audit = await new TaskCommand().run(flags);
			console.log(flags.json ? JSON.stringify(audit, null, 2) : renderTaskAudit(audit));
			if (!audit.passed) process.exitCode = 1;
		});
}

export function renderTaskAudit(audit: TaskAudit): string {
	return [
		`Task completion audit: ${audit.passed ? 'passed' : 'failed'}`,
		...audit.checks.map(
			(check) => `[${check.passed ? 'passed' : 'failed'}] ${check.id}: ${check.detail}`
		),
		audit.limitation,
		`Audit: ${audit.id}`
	].join('\n');
}

function taskUnits(value?: string): string[] {
	return value
		? value
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
		: [];
}
