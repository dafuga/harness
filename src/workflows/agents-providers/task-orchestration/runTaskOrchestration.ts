// @harness-uid u_wgjqmurp64
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ModuleTaskRunnerAdapter } from '../../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { contextThreshold } from '../../../adapters/agents-providers/module-task-runner-adapter/sessionPolicy';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { OrchestratorFlags } from '../../../commands/agents-providers/TaskOrchestrationCommand.types';
import { taskSelection } from '../../../services/agents-providers/module-task-service/taskPrompt';
import type { OrchestrationReport } from './runTaskOrchestration.types';
import {
	trackerHandoff,
	validateTrackerId
} from '../../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';

export async function runTaskOrchestration(
	root: string,
	flags: OrchestratorFlags,
	signal: AbortSignal
): Promise<OrchestrationReport> {
	const git = new GitAdapter(root);
	validateTrackerId(flags.tracker);
	if (flags.model === 'auto') throw new Error('Choose an exact orchestration model.');
	const workspace = await git.run(['rev-parse', '--show-toplevel']);
	const contextTokens = contextThreshold(flags.contextTokens);
	const selection = taskSelection({ model: flags.model, intelligence: flags.intelligence });
	const brief = await readBrief(resolve(root, flags.brief));
	const common = resolve(root, await git.run(['rev-parse', '--git-common-dir']));
	const lockDirectory = join(common, 'harness-orchestration');
	await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
	const { Database } = await import('bun:sqlite');
	const database = new Database(join(lockDirectory, `${flags.tracker}.sqlite`));
	try {
		try {
			database.exec('BEGIN IMMEDIATE');
		} catch {
			throw new Error('Could not lock the orchestration for this Tracker item and repository.');
		}
		return await supervise(workspace, brief, { ...flags, contextTokens }, { ...selection, signal });
	} finally {
		database.close();
	}
}

async function supervise(
	root: string,
	brief: string,
	flags: OrchestratorFlags,
	input: Pick<
		Parameters<ModuleTaskRunnerAdapter['run']>[0],
		'signal' | 'provider' | 'model' | 'intelligence'
	>
): Promise<OrchestrationReport> {
	const directory = join('.cache', 'harness', 'orchestration', flags.tracker);
	await mkdir(resolve(root, directory), { recursive: true, mode: 0o700 });
	const id = randomUUID();
	const { signal, ...selection } = input;
	const report: OrchestrationReport = {
		...selection,
		id,
		tracker: flags.tracker,
		status: 'running',
		file: join(directory, `${id}.json`),
		checkpoint: join(directory, 'checkpoint.md'),
		contextTokens: flags.contextTokens,
		sessions: []
	};
	const path = resolve(root, report.file);
	await saveReport(path, report);
	try {
		await new ModuleTaskRunnerAdapter().run({
			...selection,
			cwd: root,
			signal,
			prompt:
				brief +
				'\n\nUse Harness task commands to manage assignments and preserve verification evidence. Follow this brief and repository limits. Use configured independent Harness worker processes. Do not launch provider CLIs, subagents or detached watchers from this session.',
			supervision: {
				checkpoint: report.checkpoint,
				contextTokens: flags.contextTokens,
				tracker: report.tracker,
				onSession: async (session) => {
					report.sessions.push(session);
					await saveReport(path, report);
					if (['rotated', 'hard-limit', 'interrupted'].includes(session.status))
						await trackerHandoff(
							root,
							{ ...report, role: 'orchestrator', evidence: report.file },
							session
						);
				}
			}
		});
		report.status = 'succeeded';
	} catch (error) {
		report.status = signal.aborted ? 'interrupted' : 'failed';
		report.error = error instanceof Error ? error.message : 'Orchestration failed.';
	}
	await saveReport(path, report);
	return report;
}

async function saveReport(path: string, report: OrchestrationReport): Promise<void> {
	const temporary = `${path}.${randomUUID()}.tmp`;
	await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
	await rename(temporary, path);
}

async function readBrief(path: string): Promise<string> {
	const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
	try {
		const info = await file.stat();
		if (!info.isFile() || info.size > 16000)
			throw new Error('Brief must be a regular file of at most 16000 bytes.');
		const bytes = Buffer.alloc(info.size);
		const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
		const value = bytes.subarray(0, bytesRead).toString('utf8').trim();
		if (!value) throw new Error('Orchestration brief is empty.');
		return value;
	} finally {
		await file.close();
	}
}
