// @harness-uid u_gop636dbcf
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { type Command, Option } from 'commander';
import { ModuleTaskService } from '../../services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../services/agents-providers/ModuleTaskWorkerService';
import { TaskWorkerInterruptedError, type WorkerFlags } from './ModuleTaskCommand.types';
import { validateTrackerId } from '../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';
import { taskPlatformSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import { ExpectedCliError } from '../../core/development-tooling/errors';
/** Task admission, discovery and foreground worker wiring; task check keeps its completion gate. */
export class ModuleTaskCommand {
	constructor(private readonly service: ModuleTaskService = new ModuleTaskService()) {}
	register(task: Command): void {
		this.authoring(task);
		this.reads(task);
		this.operations(task);
		this.reviews(task);
	}
	private authoring(task: Command): void {
		task
			.command('feature <id>')
			.requiredOption('--goal <text>')
			.requiredOption('--tldr <text>')
			.option('--json')
			.description('Commit reusable feature context before creating module tasks.')
			.action(async (id, flags) =>
				print(await this.service.feature({ id, goal: flags.goal, tldr: flags.tldr }))
			);
		task
			.command('add')
			.requiredOption('--input <file>')
			.option('--model <id>')
			.option('--intelligence <level>')
			.option('--assignee <worker>')
			.addOption(
				new Option('--platform <os>', 'Provider task platform.').choices(taskPlatformSchema.options)
			)
			.option('--json')
			.description('Validate and Git-commit a module task and its required wantedContract.')
			.action(async (flags) => {
				const text = await readFile(flags.input, 'utf8');
				if (text.length > 1000000) throw new ExpectedCliError('Task input exceeds 1 MB.');
				const input = JSON.parse(text);
				for (const key of ['model', 'intelligence', 'assignee', 'platform'])
					if (flags[key] !== undefined) input[key] = flags[key];
				print(await this.service.add(input));
			});
	}
	private reads(task: Command): void {
		task
			.command('schema')
			.description('Print the required task and wanted-contract JSON schema.')
			.action(() => print(this.service.schema()));
		task
			.command('list')
			.option('--json')
			.action(async () => print(await this.service.list()));
		task
			.command('show <id>')
			.option('--json')
			.action(async (id) => print(await this.service.show(id)));
		task
			.command('prompt <id>')
			.description('Print the committed feature-first task prompt.')
			.action(async (id) => console.log(await this.service.prompt(id)));
	}
	private reviews(task: Command): void {
		task
			.command('review <id>')
			.requiredOption('--attempt <token>', 'Submitted claim token being reviewed.')
			.requiredOption('--verdict <verdict>', 'accepted or incomplete.')
			.option('--feedback <text>', 'Required repair instructions for an incomplete review.')
			.option(
				'--cause <cause>',
				'Rejection cause: contract, verification, scope, quality, user-correction or other.'
			)
			.option('--reviewer <id>', 'Reviewer attribution, otherwise unattributed.')
			.option(
				'--evidence <commit>',
				'Required to accept: a commit carrying the submission that a verify record proves.'
			)
			.option('--json')
			.description(
				'Accept a verified submission or requeue it with repair feedback; resending a verdict replays it.'
			)
			.action(async (id, flags) => {
				const { attempt, verdict, feedback, reviewer, cause, evidence } = flags;
				const input = { attempt, verdict, feedback, reviewer, cause, evidence };
				print(await this.service.review(id, input));
			});
	}
	private operations(task: Command): void {
		task
			.command('retry <id>')
			.option('--json')
			.description('Retry a failed or confirmed abandoned local task, retaining prior attempts.')
			.action(async (id) => print(await this.service.retry(id)));
		task
			.command('sync <remote>')
			.option('--json')
			.description(
				'Exchange refs/harness/tasks; divergent queues fail without overwriting either side.'
			)
			.action(async (remote) => print(await this.service.repository.sync(remote)));
		task
			.command('worker')
			.requiredOption('--worker <id>')
			.option('--tracker <id>', 'Record worker context handoffs on this Tracker item.')
			.option('--modules <ids>')
			.option('--once')
			.option('--watch')
			.option('--allow-task-checks', 'Run task-declared commands on the host for a trusted queue.')
			.option('--json')
			.description(
				'Preflight, then pick up matching assignments in isolated worktrees; exit 75 when blocked.'
			)
			.action(worker);
	}
}
/** EX_TEMPFAIL: nothing was claimed because this machine cannot run the queued work now. */
const blockedExit = 75;
function setWorkerExit(status: string, watching: boolean): void {
	if (status === 'failed') process.exitCode = 1;
	else if (status === 'blocked' && !watching) process.exitCode = blockedExit;
}
function print(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}
async function worker(flags: WorkerFlags): Promise<void> {
	if (flags.once && flags.watch) throw new ExpectedCliError('Choose --once or --watch.');
	const tracker = flags.tracker ?? process.env.HARNESS_ORCHESTRATION_TRACKER;
	if (tracker !== undefined) validateTrackerId(tracker);
	const controller = new AbortController(),
		stop = () => controller.abort(new TaskWorkerInterruptedError('Task worker interrupted.'));
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	try {
		const service = new ModuleTaskWorkerService(
			undefined,
			undefined,
			tracker,
			flags.allowTaskChecks
		);
		do {
			const result = await service.once(
				flags.worker,
				flags.modules
					?.split(',')
					.map((x) => x.trim())
					.filter(Boolean),
				controller.signal
			);
			print(result);
			setWorkerExit(result.status, flags.watch === true);
			if (!flags.watch || controller.signal.aborted) break;
			await setTimeout(5000, undefined, { signal: controller.signal }).catch(() => {});
		} while (!controller.signal.aborted);
	} finally {
		process.off('SIGINT', stop);
		process.off('SIGTERM', stop);
	}
}
