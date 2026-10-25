/** Exact scenario targets and assertion counts; socket lifecycles include committed planning metadata. */
export const verificationObservationCases = [
	[
		'catalog-previews',
		{
			scenario: 'catalog-previews',
			file: 'test/utils/recorded-preview.test.ts',
			state: 'preview-safety',
			count: 7,
			workspace: 'desktop'
		}
	],
	[
		'desktop-project-runs',
		{
			scenario: 'desktop-project-runs',
			file: 'test/catalog-listing.test.ts',
			state: 'project-scope',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'desktop-project-runs backend boundaries',
		{
			scenario: 'desktop-project-runs',
			file: 'test/backend-boundaries.test.ts',
			state: 'project-scope',
			count: 3,
			workspace: 'desktop'
		}
	],
	[
		'modular-h-branding-contract surfaces',
		{
			scenario: 'modular-h-branding-contract',
			file: 'test/components/brand-mark.test.ts',
			state: 'shared-surfaces',
			count: 6,
			workspace: 'reports'
		}
	],
	[
		'hosted-catalog listing',
		{
			scenario: 'hosted-catalog',
			file: 'test/hub-catalog-listing.test.ts',
			state: 'hosted-detail',
			count: 2,
			workspace: 'hub'
		}
	],
	[
		'remote-desktop-boundaries frame limits',
		{
			scenario: 'remote-desktop-boundaries',
			file: 'test/local-transport-bounds.test.ts',
			state: 'local-authority',
			count: 5,
			workspace: 'desktop'
		}
	],
	[
		'remote-desktop-boundaries socket lifecycle',
		{
			scenario: 'remote-desktop-boundaries',
			file: 'test/local-transport.test.ts',
			timeout: 120000,
			state: 'local-socket',
			count: 8,
			workspace: 'desktop'
		}
	],
	[
		'agent-references prompts',
		{
			scenario: 'agent-references',
			file: 'test/run-context-references.test.ts',
			state: 'reference-functions',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'agent-references project boundary',
		{
			scenario: 'agent-references',
			file: 'test/services/project-task.test.ts',
			state: 'project-change-boundary',
			count: 1,
			workspace: 'desktop'
		}
	],
	[
		'shells-shared-app routing',
		{
			scenario: 'shells-shared-app',
			file: 'test/shells-category.test.ts',
			state: 'shells-routing',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'design-option-storage rules',
		{
			scenario: 'design-option-storage',
			file: 'test/utils/plan-options.test.ts',
			state: 'option-storage',
			count: 13,
			workspace: 'planning'
		}
	]
] as const;
