import { categories } from '../models/Desktop.types';
import {
	commitPattern,
	enumField,
	hashPattern,
	idPattern,
	ipcFields,
	nullableText,
	regionField,
	textField,
	versionPattern
} from './ipcFields';
export function approvalPayload(value: unknown) {
	const x = ipcFields(value);
	if (!Array.isArray(x.imageHashes) || x.imageHashes.length > 24)
		throw new Error('Invalid image hashes.');
	return {
		version: textField(x.version, 20, versionPattern),
		imageHashes: x.imageHashes.map((v) => textField(v, 64, hashPattern)),
		contractHash: textField(x.contractHash, 64, hashPattern)
	};
}
export function threadPayload(x: Record<string, unknown>) {
	const version = nullableText(x.version, versionPattern);
	const imageSha256 = nullableText(x.imageSha256, hashPattern);
	const state = nullableText(x.state);
	const viewport = nullableText(x.viewport);
	const region = regionField(x.region);
	if ([imageSha256, state, viewport].some((v) => (v === null) !== (version === null)))
		throw new Error('Incomplete image anchor.');
	if (version === null && region !== null) throw new Error('Draft threads have no image region.');
	return {
		entityId: textField(x.entityId, 120, idPattern),
		version,
		imageSha256,
		state,
		viewport,
		region
	};
}
export function runPayload(x: Record<string, unknown>) {
	const mode = enumField(x.mode, ['plan', 'change']);
	const approval = x.approval === null ? null : approvalPayload(x.approval);
	if (mode === 'change' && !approval) throw new Error('A Change request needs an approved design.');
	return {
		mode,
		approval,
		provider: enumField(x.provider, ['codex', 'claude']),
		model: textField(x.model),
		effort: nullableText(x.effort),
		entityId: textField(x.entityId, 120, idPattern),
		threadId: textField(x.threadId),
		text: textField(x.text, 20000)
	};
}
export function ipcPayload(channel: string, input: unknown): unknown {
	if (channel === 'project:open' || channel === 'providers:list') return null;
	const x = ipcFields(input);
	if (channel === 'project:snapshot')
		return { branch: nullableText(x.branch), commit: nullableText(x.commit, commitPattern) };
	if (channel === 'plan:create')
		return {
			category: enumField(x.category, categories),
			title: textField(x.title, 160),
			goal: textField(x.goal, 6000)
		};
	if (channel === 'thread:open') return threadPayload(x);
	if (channel === 'run:start') return runPayload(x);
	if (channel === 'run:cancel') return { runId: textField(x.runId, 80) };
	return entityPayload(channel, x);
}
function entityPayload(channel: string, x: Record<string, unknown>) {
	const entityId = textField(x.entityId, 120, idPattern);
	if (channel === 'design:approve') return { entityId, ...approvalPayload(x) };
	const commit = textField(x.commit, 40, commitPattern);
	const base = { entityId, commit };
	if (channel === 'entity:source') return { ...base, path: textField(x.path, 1000) };
	if (channel === 'image:read')
		return {
			...base,
			version: textField(x.version, 20, versionPattern),
			sha256: textField(x.sha256, 64, hashPattern)
		};
	if (channel === 'thread:messages') return { ...base, threadId: textField(x.threadId) };
	return base;
}
