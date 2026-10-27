import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import type { Command } from 'commander';
import { ModuleTaskService } from '../../services/agents-providers/ModuleTaskService';
import { ModuleTaskServerService } from '../../services/agents-providers/ModuleTaskServerService';
import { ModuleTaskWorkerService } from '../../services/agents-providers/ModuleTaskWorkerService';
import { FeaturePlanCommand } from './FeaturePlanCommand';
import type { ServeFlags, TaskServer, WorkerFlags } from './ModuleTaskCommand.types';
/** Task admission, discovery and foreground worker wiring; task check keeps its completion gate. */
export class ModuleTaskCommand {
	constructor(
		private readonly service = new ModuleTaskService(),
		private readonly server: Pick<ModuleTaskServerService, 'run'> = new ModuleTaskServerService(
			process.cwd()
		),
		private readonly workerService?: Pick<ModuleTaskWorkerService, 'once'>
	) {}
	register(task: Command): void {
		this.authoring(task);
		this.reads(task);
		this.operations(task);
		serverCommands(task, this.server);
		this.reviews(task);
		new FeaturePlanCommand().register(task);
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
			.option('--json')
			.description('Validate and Git-commit a module task and its required wantedContract.')
			.action(async (flags) => {
				const text = await readFile(flags.input, 'utf8');
				if (text.length > 1000000) throw new Error('Task input exceeds 1 MB.');
				const input = JSON.parse(text);
				for (const key of ['model', 'intelligence', 'assignee'])
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
			.option('--reviewer <id>', 'Reviewer attribution, otherwise unattributed.')
			.option('--json')
			.description('Accept a submission or preserve its work and requeue it with repair feedback.')
			.action(async (id, flags) => {
				const { attempt, verdict, feedback, reviewer } = flags;
				print(await this.service.review(id, { attempt, verdict, feedback, reviewer }));
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
			.option('--modules <ids>')
			.option('--once')
			.option('--watch')
			.option('--json')
			.description(
				'Pick up matching assignments in isolated worktrees; watch polls until interrupted.'
			)
			.action((flags: WorkerFlags) => worker(flags, this.workerService));
	}
}
function serverCommands(task: Command, server: TaskServer): void {
	task
		.command('serve')
		.requiredOption('--input <file>')
		.requiredOption('--worker <id>')
		.option(
			'--module <id>',
			'Limit dispatch to this module; repeat to include more modules.',
			(id, modules: string[] = []) => [...modules, id],
			[]
		)
		.option('--once', 'Run one worker attempt instead of watching.')
		.option('--json', 'Print the actual server result as JSON.')
		.description(
			'Submit a committed plan to server-managed workers; watch until interrupted by default.'
		)
		.action((flags: ServeFlags) => runServerPlan(server, flags));
}
async function runServerPlan(server: TaskServer, flags: ServeFlags): Promise<void> {
	const plan = JSON.parse(await readFile(flags.input, 'utf8'));
	const controller = new AbortController();
	const abort = () => controller.abort(new Error('Module task server interrupted.'));
	process.on('SIGINT', abort);
	process.on('SIGTERM', abort);
	try {
		print(
			await server.run(plan, {
				worker: flags.worker,
				modules: flags.module ?? [],
				once: flags.once ?? false,
				signal: controller.signal
			})
		);
	} finally {
		process.off('SIGINT', abort);
		process.off('SIGTERM', abort);
	}
}
function print(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}
async function worker(
	flags: WorkerFlags,
	injected?: Pick<ModuleTaskWorkerService, 'once'>
): Promise<void> {
	if (flags.once && flags.watch) throw new Error('Choose --once or --watch.');
	const controller = new AbortController(),
		stop = () => controller.abort(new Error('Task worker interrupted.'));
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	try {
		const service = injected ?? new ModuleTaskWorkerService();
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
			if (result.status === 'failed') process.exitCode = 1;
			if (!flags.watch || controller.signal.aborted) break;
			await setTimeout(5000, undefined, { signal: controller.signal }).catch(() => {});
		} while (!controller.signal.aborted);
	} finally {
		process.off('SIGINT', stop);
		process.off('SIGTERM', stop);
	}
}
