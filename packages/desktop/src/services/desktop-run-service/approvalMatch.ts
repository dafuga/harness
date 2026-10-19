import type { EntityDetail, ApprovalInfo } from '../../models/Desktop.types.ts';
import type { RunRequest } from '../../models/DesktopBridge.types.ts';

function exactBinding(
	entity: EntityDetail,
	approval: ApprovalInfo,
	target: NonNullable<RunRequest['approval']>
): boolean {
	return (
		entity.latestVersion === target.version &&
		approval.version === target.version &&
		approval.contractHash === target.contractHash &&
		entity.contract.hash === target.contractHash
	);
}

export function approvalMatch(entity: EntityDetail, request: RunRequest): void {
	if (request.mode !== 'change') return;
	const approval = entity.versions.at(-1)?.approval,
		target = request.approval;
	if (!approval || !approval.current || !target)
		throw new Error('A current approved design is required.');
	if (!exactBinding(entity, approval, target))
		throw new Error('This design/contract is not currently approved. Review the latest version.');
	validateImages(approval, target);
	validateAnchor(entity, request, target);
}

function validateImages(approval: ApprovalInfo, target: NonNullable<RunRequest['approval']>) {
	if (
		JSON.stringify([...approval.imageHashes].sort()) !==
		JSON.stringify([...target.imageHashes].sort())
	)
		throw new Error('The requested images differ from the approval.');
	if ((approval.option ?? null) !== (target.option ?? null))
		throw new Error('The requested design option differs from the approval.');
}

function validateAnchor(
	entity: EntityDetail,
	request: RunRequest,
	{ version, option }: NonNullable<RunRequest['approval']>
) {
	const anchor = entity.threads.find((t) => t.id === request.threadId);
	if (!anchor) throw new Error('Thread does not belong to this entity.');
	if (anchor.version && anchor.version !== version)
		throw new Error(
			'This image thread is from an earlier design. Open a thread on the approved version.'
		);
	// A thread on one design option never asks for the Change of another, approved or not.
	if (anchor.option && anchor.option !== option)
		throw new Error('This image thread is on another design option than the approved one.');
}
