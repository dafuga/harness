import { deploymentEnvironments } from '../../../models/Deployment.types';
import { evidencePayload } from '../../verification-evidence/evidencePayload';
import { categories } from '../../../models/development-tooling/Desktop.types';
import {
	commitPattern,
	enumField,
	hashPattern,
	idPattern,
	ipcFields,
	nullableText,
	textField,
	versionPattern
} from '../ipcFields';
import { regionField } from './regionField';
import { planPayload } from './planPayload';

export function approvalPayload(value: unknown) {
	const x = ipcFields(value);
	if (!Array.isArray(x.imageHashes) || x.imageHashes.length > 24)
		throw new Error('Invalid image hashes.');
	return {
		version: textField(x.version, 20, versionPattern),
		imageHashes: x.imageHashes.map((v) => textField(v, 64, hashPattern)),
		contractHash: textField(x.contractHash, 64, hashPattern),
		...optionField(x.option)
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
		region,
		...optionField(x.option)
	};
}

/** A project as this computer or the hub names one; nothing else names a project to add to. */
const project = /^(?:local-[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;

export function creationProject(value: unknown): string {
	if (typeof value !== 'string' || !project.test(value))
		throw new Error('A creation request names its project.');
	return value;
}

const creation = [
	...['intent', 'category', 'mode', 'provider', 'model', 'effort', 'text', 'projectId'],
	'designOptions'
];

/** A request for something new: a Plan with a catalog as its hint, and no entity of its own. */
export function creationPayload(x: Record<string, unknown>) {
	if (Object.keys(x).some((key) => !creation.includes(key)))
		throw new Error('A creation request names no entity, thread or approval.');
	return {
		intent: enumField(x.intent, ['create']),
		projectId: creationProject(x.projectId),
		category: enumField(x.category, categories),
		mode: enumField(x.mode, ['plan']),
		provider: enumField(x.provider, ['codex', 'claude']),
		model: textField(x.model),
		effort: nullableText(x.effort),
		text: textField(x.text, 20000),
		...countField(x.designOptions)
	};
}

/** General chat cannot choose a directory or silently act on a different revision. */
function taskPayload(x: Record<string, unknown>) {
	const allowed = [...creation, 'branch', 'commit', 'conversation', 'environment'];
	if (Object.keys(x).some((key) => !allowed.includes(key))) throw new Error('Invalid task fields.');
	const conversation = x.conversation ?? [];
	if (!Array.isArray(conversation) || conversation.length > 20)
		throw new Error('Invalid conversation.');
	return {
		intent: 'task' as const,
		projectId: creationProject(x.projectId),
		category: enumField(x.category, categories),
		mode: enumField(x.mode, ['ask', 'change']),
		...(x.environment === undefined
			? {}
			: { environment: enumField(x.environment, deploymentEnvironments) }),
		branch: textField(x.branch),
		commit: textField(x.commit, 40, commitPattern),
		provider: enumField(x.provider, ['codex', 'claude']),
		model: textField(x.model),
		effort: nullableText(x.effort),
		text: textField(x.text, 20000),
		conversation: conversation.map((entry) => {
			const value = ipcFields(entry);
			return {
				author: enumField(value.author, ['user', 'agent']),
				text: textField(value.text, 4000)
			};
		})
	};
}

export function runPayload(x: Record<string, unknown>) {
	if (x.intent === 'task') return taskPayload(x);
	if (x.intent !== undefined) return creationPayload(x);
	const mode = enumField(x.mode, ['plan', 'change']);
	const approval = x.approval === null ? null : approvalPayload(x.approval);
	if (mode === 'change' && !approval) throw new Error('A Change request needs an approved design.');
	if (mode === 'change' && x.designOptions !== undefined)
		throw new Error('A Change makes no design options.');
	return {
		mode,
		approval,
		provider: enumField(x.provider, ['codex', 'claude']),
		model: textField(x.model),
		effort: nullableText(x.effort),
		entityId: textField(x.entityId, 120, idPattern),
		threadId: textField(x.threadId),
		text: textField(x.text, 20000),
		...countField(x.designOptions),
		...(x.environment === undefined
			? {}
			: { environment: enumField(x.environment, deploymentEnvironments) })
	};
}

/** A Plan's design options: left out, or a whole number from 1 to 10. */
function countField(value: unknown) {
	if (value === undefined) return {};
	if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10)
		throw new Error('Design options must be a whole number from 1 to 10.');
	return { designOptions: value as number };
}

/** A design option of a version, `o1` to `o10`, when one is named. */
function optionField(value: unknown) {
	return value === undefined ? {} : { option: textField(value, 3, /^o(?:[1-9]|10)$/) };
}

export function ipcPayload(channel: string, input: unknown): unknown {
	if (channel === 'project:open' || channel === 'providers:list') return null;
	const x = ipcFields(input);
	if (channel === 'project:snapshot')
		return { branch: nullableText(x.branch), commit: nullableText(x.commit, commitPattern) };
	if (channel.startsWith('deployment:')) return deploymentPayload(channel, x);
	if (channel === 'plan:create') return planPayload(x);
	if (channel === 'thread:open') return threadPayload(x);
	if (channel === 'run:start') return runPayload(x);
	if (channel === 'run:cancel') return { runId: textField(x.runId, 80) };
	return channel.startsWith('evidence:') ? evidencePayload(channel, x) : entityPayload(channel, x);
}

function entityPayload(channel: string, x: Record<string, unknown>) {
	const entityId = textField(x.entityId, 120, idPattern);
	if (channel === 'design:approve') return { entityId, ...approvalPayload(x) };
	const commit = textField(x.commit, 40, commitPattern);
	const base = { entityId, commit };
	if (channel === 'entity:history') {
		if (!Number.isInteger(x.page) || Number(x.page) < 1 || Number(x.page) > 10000)
			throw new Error('Invalid history page.');
		return {
			...base,
			page: Number(x.page),
			...(x.branch === undefined ? {} : { branch: textField(x.branch) })
		};
	}
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

function deploymentPayload(channel: string, x: Record<string, unknown>) {
	if (channel === 'deployment:status' || channel === 'deployment:activities') return {};
	if (channel === 'deployment:plan')
		return {
			environment: enumField(x.environment, deploymentEnvironments),
			commit: textField(x.commit, 64, /^[a-f0-9]{40,64}$/)
		};
	return { planId: textField(x.planId, 36, /^[a-f0-9-]{36}$/) };
}
