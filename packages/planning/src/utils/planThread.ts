import { planIdentity } from './planIdentity';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import type {
	OpenThreadInput,
	MessageDraft,
	AppendMessageInput
} from '../models/PlanningBridge.types';
import type {
	PlanDetail,
	PlanThread,
	ThreadMessage,
	ThreadAnchor,
	ApprovalRecord,
	HostFileChange
} from '../models/Planning.types';
import type { Git } from './planGit';
import { blob, revision } from './planGit';
import { planRead } from './planRead';
import { readImage } from './planDesign';
import { optionOf } from './planOptions';
import { clean, commitFiles, type Files } from './planWrite';
import { fail, hash, json, now, planData } from './planData';
import { author, filename, region, text } from './planValidate';
function messageValue(
	input: MessageDraft,
	plan: PlanDetail,
	thread: PlanThread,
	previous: string
): ThreadMessage {
	author(input.author);
	text(input.body);
	if (!['plan', 'change'].includes(input.mode)) fail('invalid-input', 'Invalid message mode');
	if (input.agent) {
		text(input.agent.provider);
		text(input.agent.model);
	}
	if (input.mode === 'change') validateChange(input, plan);
	else if (input.change) fail('invalid-input', 'Plan message cannot contain a change request');
	for (const reference of input.references ?? []) validateReference(reference, plan);
	return {
		id: randomUUID(),
		unitId: plan.unitId,
		threadId: thread.id,
		sequence: thread.messages.length + 1,
		previous,
		at: now(),
		author: input.author,
		mode: input.mode,
		agent: input.agent ?? null,
		body: input.body,
		references: input.references ?? [],
		change: changeRecord(input)
	};
}
function changeRecord(input: MessageDraft): ThreadMessage['change'] {
	if (!input.change) return null;
	return {
		...input.change,
		changedPaths: input.change.changedPaths ?? [],
		error: input.change.error ?? null
	};
}
function changedPath(path: string): void {
	text(path);
	if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\\'))
		fail('unsafe-path', 'Invalid changed path');
}
function validateReference(reference: ThreadMessage['references'][number], plan: PlanDetail): void {
	if (reference.kind === 'approval' && plan.approvals.some((a) => a.id === reference.approvalId))
		return;
	if (
		reference.kind === 'notes' &&
		plan.versions.some(
			(v) => v.version === reference.version && v.notes && v.notes.sha256 === reference.sha256
		)
	)
		return;
	if (
		reference.kind === 'image' &&
		plan.versions.some(
			(v) =>
				v.version === reference.version &&
				v.images.some((i) => i.file === reference.file && i.sha256 === reference.sha256) &&
				(reference.option === undefined || optionOf(v, reference.file) === reference.option)
		)
	)
		return;
	fail('invalid-input', 'Reference is not an artifact of this entity');
}
function approvedContent(approval: ApprovalRecord, imageHash: string | null): boolean {
	if (imageHash === null) return approval.images.length === 0 && approval.notesSha256 !== null;
	return approval.images.some((image) => image.sha256 === imageHash);
}
function validateChange(input: MessageDraft, plan: PlanDetail): void {
	const change = input.change;
	const approval = plan.approval;
	if (!change || !approval) fail('approval-required', 'Change requires a current approval');
	const target = change.target;
	if (
		target.approvalId !== approval.id ||
		target.version !== approval.version ||
		target.contractHash !== approval.contractHash
	)
		fail('approval-mismatch', 'Change target is not the current approval');
	if (!approvedContent(approval, target.imageSha256))
		fail('approval-mismatch', 'Change image is not approved');
	if (!['requested', 'running', 'completed', 'failed', 'cancelled'].includes(change.status))
		fail('invalid-input', 'Invalid change status');
	validateChangedFiles(change);
}
function validateChangedFiles(change: NonNullable<MessageDraft['change']>) {
	for (const path of change.changedPaths ?? []) changedPath(path);
	for (const operation of change.hostChanges ?? []) validateHostFile(operation);
}
function validateHostFile(operation: HostFileChange) {
	text(operation.path);
	if (!isAbsolute(operation.path) || operation.path.includes('\0'))
		fail('unsafe-path', 'Host operation requires an absolute path');
	if (operation.coverage !== 'observed-cli-file-operation')
		fail('invalid-input', 'Unknown host tracking coverage');
	if (operation.before !== null) text(operation.before);
	if (operation.after !== null) text(operation.after);
}
async function anchor(
	git: Git,
	input: OpenThreadInput,
	viewedRevision: string
): Promise<ThreadAnchor | null> {
	if (
		input.version === null &&
		input.file === null &&
		input.imageSha256 === null &&
		input.region === null
	)
		return null;
	if (!input.version || !input.file || !input.imageSha256)
		fail('invalid-input', 'Partial image anchor');
	const image = await readImage(git, {
		unitId: input.unitId,
		version: input.version,
		file: input.file,
		sha256: input.imageSha256,
		option: input.option,
		revision: viewedRevision
	});
	return {
		version: input.version,
		file: input.file,
		imageSha256: input.imageSha256,
		state: image.state,
		viewport: image.viewport,
		region: region(input.region),
		...(image.option ? { option: image.option } : {})
	};
}
export async function planThread(git: Git, input: OpenThreadInput) {
	const path = await planIdentity(git, await revision(git), input.unitId);
	await clean(git, path);
	const rev = await revision(git);
	const plan = await planRead(git, rev, input.unitId);
	author(input.author);
	const viewedRevision = await revision(git, input.viewedRevision);
	await planRead(git, viewedRevision, input.unitId);
	const target = await anchor(git, input, viewedRevision);
	if (target)
		await readImage(git, {
			unitId: input.unitId,
			version: target.version,
			file: target.file,
			sha256: target.imageSha256,
			option: target.option
		});
	const value = {
		id: randomUUID(),
		unitId: input.unitId,
		pin: plan.threads.length + 1,
		title: input.title ?? '',
		anchor: target,
		viewedRevision,
		createdAt: now(),
		createdBy: input.author
	};
	const thread = { ...value, commit: '', messages: [] } as PlanThread;
	const metadata = json(value);
	const message = input.message ? messageValue(input.message, plan, thread, hash(metadata)) : null;
	const base = `${path}/threads/${value.id}`;
	const files: Files = {
		[`${base}/thread.json`]: metadata,
		[`${base}/messages.ndjson`]: message ? json(message) : ''
	};
	const committed = await commitFiles(git, files, `feat: open ${input.unitId} thread`);
	return {
		...committed,
		value: { ...value, commit: committed.commit, messages: message ? [message] : [] }
	};
}
export async function append(git: Git, input: AppendMessageInput) {
	const path = await planIdentity(git, await revision(git), input.unitId);
	filename(input.threadId);
	await clean(git, path);
	const rev = await revision(git);
	const plan = await planRead(git, rev, input.unitId);
	const thread = plan.threads.find((t) => t.id === input.threadId);
	if (!thread) fail('not-found', 'Thread not found');
	const base = `${path}/threads/${thread.id}`;
	const existing = await blob(git, rev, `${base}/messages.ndjson`);
	const previous = thread.messages.length
		? hash(planData(thread.messages.at(-1)))
		: hash(await blob(git, rev, `${base}/thread.json`));
	const value = messageValue(input, plan, thread, previous);
	const committed = await commitFiles(
		git,
		{ [`${base}/messages.ndjson`]: existing.toString() + json(value) },
		`feat: append ${input.unitId} message`
	);
	return { ...committed, value };
}
