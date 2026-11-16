// @harness-uid u_uicoazlmfj
export class DesignApprovalRequiredError extends Error {
	override name = 'DesignApprovalRequiredError';
}

export class ApprovalVersionMismatchError extends Error {
	override name = 'ApprovalVersionMismatchError';
}
