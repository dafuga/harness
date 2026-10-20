import { REMOTE_PROTOCOL, RemoteFailure } from '../models/Remote.types';
import type {
	AttachInput,
	RemoteErrorCode,
	RemoteResume,
	RemoteRevision
} from '../models/Remote.types';
import type { RemoteApprovalInput } from '../models/RemoteControl.types';
import { remotePatterns } from '../utils/remoteIdentity';

type Fields = Record<string, unknown>;
const kinds = ['electron', 'ios', 'test'];
const commit = /^[a-f0-9]{40}$/;

function fields(value: unknown): Fields | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null;
}
/** The value as a record with exactly these keys, or a refusal. */
function exact(value: unknown, keys: string, code: RemoteErrorCode = 'invalid-message'): Fields {
	const item = fields(value);
	if (!item || Object.keys(item).sort().join(',') !== keys) throw new RemoteFailure(code);
	return item;
}
function matching(value: unknown, pattern: RegExp, code: RemoteErrorCode): string {
	if (typeof value !== 'string' || !pattern.test(value)) throw new RemoteFailure(code);
	return value;
}
function client(value: unknown): AttachInput['client'] {
	const item = exact(value, 'kind,name'),
		{ kind, name } = item;
	const named = typeof name === 'string' && name.trim().length > 0 && name.length <= 80;
	if (!kinds.includes(kind as string) || !named) throw new RemoteFailure('invalid-message');
	return { kind: kind as AttachInput['client']['kind'], name: name as string };
}
function resume(value: unknown): RemoteResume | null {
	if (value === null) return null;
	const item = exact(value, 'epoch,sequence'),
		{ sequence } = item;
	if (!Number.isSafeInteger(sequence) || (sequence as number) < 0)
		throw new RemoteFailure('invalid-message');
	return {
		epoch: matching(item.epoch, remotePatterns.epoch, 'invalid-message'),
		sequence: sequence as number
	};
}
function commentGrant(
	item: Fields,
	included: boolean | null
): Pick<RemoteApprovalInput, 'comments'> {
	if (!included) return {};
	if (typeof item.comments !== 'boolean' || (item.agents && !item.comments))
		throw new RemoteFailure('invalid-message');
	return { comments: item.comments };
}

/** Inputs the protocol itself defines. Bridge inputs are validated by the host's own rules. */
export class RemoteInputValidator {
	attach(input: unknown): AttachInput {
		const protocol = fields(input)?.protocol;
		if (typeof protocol === 'number' && protocol !== REMOTE_PROTOCOL)
			throw new RemoteFailure('protocol-unsupported');
		const item = exact(input, 'client,protocol,resume');
		if (protocol !== REMOTE_PROTOCOL) throw new RemoteFailure('invalid-message');
		return { protocol: REMOTE_PROTOCOL, client: client(item.client), resume: resume(item.resume) };
	}
	/** A project registered on the computer. Paths and hosted project ids never match. */
	projectId(input: Fields): string {
		if (input.projectId === undefined) throw new RemoteFailure('project-required');
		return matching(input.projectId, remotePatterns.projectId, 'project-denied');
	}
	revision(input: Fields): RemoteRevision {
		if (input.revision === undefined) throw new RemoteFailure('revision-required');
		const item = exact(input.revision, 'branch,commit', 'revision-required'),
			{ branch } = item;
		const named = typeof branch === 'string' && branch.length > 0 && branch.length <= 255;
		if (!named) throw new RemoteFailure('revision-required');
		return {
			branch: branch as string,
			commit: matching(item.commit, commit, 'revision-required')
		};
	}
	approval(input: unknown): RemoteApprovalInput {
		const present = fields(input);
		const withComments = present && Object.hasOwn(present, 'comments');
		const item = exact(
				input,
				withComments
					? 'agents,comments,deviceId,pairingId,projectIds'
					: 'agents,deviceId,pairingId,projectIds'
			),
			ids = Array.isArray(item.projectIds) ? (item.projectIds as unknown[]) : [];
		const projectIds = ids.map((id) => matching(id, remotePatterns.projectId, 'invalid-message'));
		const distinct = new Set(projectIds).size === projectIds.length;
		if (!ids.length || ids.length > 64 || !distinct || typeof item.agents !== 'boolean')
			throw new RemoteFailure('invalid-message');
		const { pairingId } = this.pairing({ pairingId: item.pairingId }),
			{ deviceId } = this.device({ deviceId: item.deviceId });
		return {
			pairingId,
			deviceId,
			projectIds,
			agents: item.agents,
			...commentGrant(item, withComments)
		};
	}
	pairing(input: unknown): { pairingId: string } {
		const item = exact(input, 'pairingId');
		return { pairingId: matching(item.pairingId, remotePatterns.pairingId, 'invalid-message') };
	}
	device(input: unknown): { deviceId: string } {
		const item = exact(input, 'deviceId');
		return { deviceId: matching(item.deviceId, remotePatterns.deviceId, 'invalid-message') };
	}
}
