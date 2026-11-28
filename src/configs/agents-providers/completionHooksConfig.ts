// @harness-uid u_kfnyynupit
export const completionHooksConfig = {
	file: 'harness.completion.json',
	simplify: 'simplify-contract',
	reduce: 'reduce-module-bytes',
	security: 'security-review',
	checks: [
		{
			name: 'simplify-contract',
			scope: 'orchestrator',
			required: true,
			enabled: true,
			prompt:
				'Simplify the contracts relevant to this task as much as possible. Edit the contract text to remove repetition while preserving every requirement, boundary, and acceptance criterion.'
		},
		{
			name: 'reduce-module-bytes',
			scope: 'module',
			required: true,
			enabled: true,
			prompt:
				'Reduce the bytes of both the module and its tests without weakening any required behavior, assertion, or coverage. Harness keeps a reduction only when the source bytes and the test bytes both shrink, the tests still pass, and line coverage of every changed source file is measured and does not drop. Harness discards a reduction if it cannot verify the candidate against the baseline and the declared task check. When no such reduction is available, leave every file unchanged and return status "passed" with a summary saying so.'
		},
		...(['orchestrator', 'module'] as const).map((scope) => ({
			name: 'security-review',
			scope,
			required: false,
			enabled: false,
			prompt:
				'Review the completed task for defensive security issues. Report actionable findings without disclosing credentials or developing exploits.'
		}))
	]
} as const;
