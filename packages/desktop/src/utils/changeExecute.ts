import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unitOwners } from '../../../../src/utils/unitOwners';
import type { RunContext } from '../models/RunContext.types';
import { RunCancelled } from '../models/AgentRunner.types';
import { changedUnits } from './changedUnits';
import { isUnitId } from './entityReferences';
import { runContext } from './runContext';
import { sourceSnapshot } from './sourceSnapshot';
import type { SourceSnapshot } from './sourceSnapshot';
import { sourceChanges } from './sourceChanges';
import type { hostChanges } from './hostChanges';
/** What the agent of a change said in public, kept for its notice also when the run failed. */
const replies = new WeakMap<RunContext, string>();
/** A longer reply keeps its beginning and says that it was cut. */
const most = 20_000;
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
	const named = isUnitId(entity.id) ? `[[unit:${entity.id}]]` : 'the approved design';
	emit({
		runId: id,
		kind: 'status',
		phase: 'changing',
		detail: `Implementing ${named} with ${request.provider} / ${request.model}`
	});
	const notes = entity.versions.at(-1)?.notes ?? '';
	replies.set(context, '');
	const result = await context.runner.run({
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
		onText: (text) => {
			replies.set(context, (replies.get(context) ?? '') + text);
			emit({ runId: id, kind: 'text', text });
		},
		onStatus: () => {},
		onFile: options.observe
	});
	if (result.text.trim()) replies.set(context, result.text);
	if (context.signal.aborted) throw new RunCancelled();
}
/** The reply that was given or streamed so far, once, bounded; empty when nothing was said. */
function reply(context: RunContext): string {
	const said = (replies.get(context) ?? '').trim();
	replies.delete(context);
	return said.length > most ? said.slice(0, most) + '\n…' : said;
}
/** The units that own the changed files by the registry of the revision the change was made at. */
async function owners(context: RunContext, paths: string[]): Promise<string> {
	const { source } = context.session.requireProject();
	const units = await source.units(context.revision.commit).catch(() => null);
	if (!units) return '';
	const owned = unitOwners(units.map((unit) => ({ id: unit.id, source: unit.owns.source })));
	return changedUnits(paths, owned);
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
	const paths = changes.map((c) => c.path);
	const units = await owners(context, paths);
	const summary = `Change ${status}: ${changes.length} project files; ${hostFiles.length} observed host operations. ${units ? units + ' ' : ''}Verification pending.`;
	const said = reply(context);
	await planning.appendMessage({
		entityId: entity.id,
		threadId: request.threadId,
		author: 'agent',
		text: said ? `${said}\n\n${summary}` : summary,
		mode: 'change',
		provider: request.provider,
		model: request.model,
		version: request.approval!.version,
		imageSha256: request.approval!.imageHashes[0] ?? null,
		change: {
			status,
			paths,
			hostChanges: hostFiles,
			error: outcome.failure?.message.slice(0, 600) ?? null
		}
	});
}
function changeStatus(context: RunContext, failure: Error | null) {
	if (context.signal.aborted || failure instanceof RunCancelled) return 'cancelled' as const;
	return failure ? ('failed' as const) : ('completed' as const);
}
