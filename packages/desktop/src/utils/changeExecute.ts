import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunContext } from '../models/RunContext.types';
import { RunCancelled } from '../models/AgentRunner.types';
import { runContext } from './runContext';
import { sourceSnapshot } from './sourceSnapshot';
import type { SourceSnapshot } from './sourceSnapshot';
import { sourceChanges } from './sourceChanges';
import type { hostChanges } from './hostChanges';
async function approvedImage(context: RunContext, directory: string) {
	const approval = context.request.approval!;
	if (!approval.imageHashes[0]) return null;
	const reference = join(directory, 'approved.png');
	await writeFile(
		reference,
		await context.planning.image({
			entityId: context.entity.id,
			version: approval.version,
			sha256: approval.imageHashes[0],
			revision: context.revision.commit
		})
	);
	return reference;
}
export async function changeExecute(
	context: RunContext,
	options: {
		directory: string;
		observe: (path: string) => void;
	}
) {
	const { request, entity, id, emit } = context;
	const reference = await approvedImage(context, options.directory);
	emit({
		runId: id,
		kind: 'status',
		phase: 'changing',
		detail: 'Implementing the approved design with ' + request.provider + ' / ' + request.model
	});
	const notes = entity.versions.at(-1)?.notes ?? '';
	await context.runner.run({
		model: request.model,
		effort: request.effort,
		cwd: context.root,
		prompt:
			(await runContext(context)) +
			'\nImplement exactly approval ' +
			JSON.stringify(request.approval) +
			'. Approved visual: ' +
			(reference ?? 'none (headless)') +
			'.\nApproved behavior: ' +
			notes,
		reference,
		access: 'write',
		signal: context.signal,
		onText: (text) => emit({ runId: id, kind: 'text', text }),
		onStatus: () => {},
		onFile: options.observe
	});
	if (context.signal.aborted) throw new RunCancelled();
}
export async function recordChange(
	context: RunContext,
	outcome: {
		before: SourceSnapshot;
		host: ReturnType<typeof hostChanges>;
		failure: Error | null;
	}
) {
	const { request, planning, entity, emit, id } = context;
	const changes = sourceChanges(outcome.before, await sourceSnapshot(context.root));
	const hostFiles = await outcome.host.record(id);
	emit({ runId: id, kind: 'changes', files: changes });
	await context.session.atBranch(context.revision.branch);
	const status = changeStatus(context, outcome.failure);
	await planning.appendMessage({
		entityId: entity.id,
		threadId: request.threadId,
		author: 'agent',
		text:
			'Change ' +
			status +
			': ' +
			changes.length +
			' project files; ' +
			hostFiles.length +
			' observed host operations. Verification pending.',
		mode: 'change',
		provider: request.provider,
		model: request.model,
		version: request.approval!.version,
		imageSha256: request.approval!.imageHashes[0] ?? null,
		change: {
			status,
			paths: changes.map((c) => c.path),
			hostChanges: hostFiles,
			error: outcome.failure?.message.slice(0, 600) ?? null
		}
	});
}
function changeStatus(context: RunContext, failure: Error | null) {
	if (context.signal.aborted || failure instanceof RunCancelled) return 'cancelled' as const;
	return failure ? ('failed' as const) : ('completed' as const);
}
