import type { PlanDetail, AppendMessageInput } from '../../../planning/src/index';
import type { MessageDraft } from '../models/PlanningPort.types';
import type { PlanningContext } from './planningReads';
import { messageInfo } from './planningConvert';
import { reviewer } from './planningWrites';
export async function planningMessage(context: PlanningContext, draft: MessageDraft) {
	const plan = await context.api.readPlan({ unitId: draft.entityId });
	const input: AppendMessageInput = {
		unitId: draft.entityId,
		threadId: draft.threadId,
		author:
			draft.author === 'user' ? reviewer : { kind: 'agent', name: draft.provider ?? 'Harness' },
		mode: draft.mode ?? 'plan',
		agent: draft.provider && draft.model ? { provider: draft.provider, model: draft.model } : null,
		body: draft.text,
		references: imageReferences(plan, draft)
	};
	if (draft.mode === 'change') input.change = changeTarget(plan, draft);
	return messageInfo((await context.api.appendMessage(input)).value);
}
function imageReferences(plan: PlanDetail, draft: MessageDraft): AppendMessageInput['references'] {
	const version = plan.versions.find((v) => v.version === draft.version),
		image = version?.images.find((i) => i.sha256 === draft.imageSha256);
	return image && version
		? [{ kind: 'image', version: version.version, file: image.file, sha256: image.sha256 }]
		: [];
}
function changeTarget(plan: PlanDetail, draft: MessageDraft): AppendMessageInput['change'] {
	const approval = plan.approval;
	if (!approval) throw new Error('An approved design is required.');
	if (draft.version !== approval.version)
		throw new Error('This change is bound to a different approved version.');
	return {
		target: {
			approvalId: approval.id,
			version: approval.version,
			imageSha256: draft.imageSha256,
			contractHash: approval.contractHash
		},
		status: draft.change?.status ?? 'requested',
		changedPaths: draft.change?.paths,
		hostChanges: draft.change?.hostChanges,
		error: draft.change?.error
	};
}
