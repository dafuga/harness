import type {
	PlanThread,
	ThreadMessage as StoredMessage,
	ApprovalRecord
} from '../../../../planning/src/lib/planning/index';
import type {
	ApprovalInfo,
	ThreadInfo,
	ThreadMessage,
	ProviderId
} from '../../models/development-tooling/Desktop.types';

export function approvalInfo(record: ApprovalRecord): ApprovalInfo {
	return {
		id: record.id,
		version: record.version,
		imageHashes: record.images.map((i) => i.sha256),
		contractHash: record.contractHash,
		approvedAt: record.approvedAt,
		current: record.current,
		...(record.option ? { option: record.option } : {})
	};
}

export function threadInfo(thread: PlanThread): ThreadInfo {
	const anchor = thread.anchor ?? {
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	};
	return {
		id: thread.id,
		pin: thread.pin,
		version: anchor.version,
		imageSha256: anchor.imageSha256,
		state: anchor.state,
		viewport: anchor.viewport,
		region: anchor.region,
		...(thread.anchor?.option ? { option: thread.anchor.option } : {}),
		messageCount: thread.messages.length
	};
}

export function messageInfo(message: StoredMessage): ThreadMessage {
	const image = message.references.find((r) => r.kind === 'image');
	return {
		id: message.id,
		at: message.at,
		author: message.author.kind === 'person' ? 'user' : 'agent',
		text: message.body,
		mode: message.mode,
		provider: (message.agent?.provider as ProviderId) ?? null,
		model: message.agent?.model ?? null,
		version: messageVersion(message),
		imageSha256: image?.kind === 'image' ? image.sha256 : null
	};
}

function messageVersion(message: StoredMessage) {
	const image = message.references.find((r) => r.kind === 'image');
	const notes = message.references.find((r) => r.kind === 'notes');
	return image?.version ?? notes?.version ?? message.change?.target.version ?? null;
}

export { planningConvert } from './planning-reads/planningConvert';
