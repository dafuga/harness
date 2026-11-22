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
				'Reduce the bytes of both the module and its tests without weakening any required behavior, assertion, or coverage. Leave them unchanged when no safe reduction is available.'
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
