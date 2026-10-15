import type { VerificationScope } from './verification-targets';

/** Real proposal persistence and DOM observations share the same declared scenario. */
export const agentCreationVerificationScopes: Record<string, VerificationScope> = {
	'agent-creation': {
		package: 'desktop',
		vitest: {
			'test/project-conversation.test.ts': {
				'a project conversation creates the proposed function and retains its original request':
					'boundary-tests',
				'an invalid creation proposal creates no plan and emits no success': 'boundary-tests'
			},
			'test/project-conversation-boundaries.test.ts': {
				'a pinned commit rejects project creation before any CLI or plan write': 'boundary-tests',
				'an unlisted model and the wrong project reject before creation': 'boundary-tests',
				'unexpected source writes during proposal generation remain recoverable and create no plan':
					'boundary-tests',
				'only the owning run may cancel, and a cancelled proposal writes no plan': 'boundary-tests',
				'a branch changed during the read-only proposal cannot receive its plan': 'boundary-tests',
				'a source revision advanced during proposal generation receives no new plan':
					'boundary-tests',
				'a creation request without a project refuses before the CLI': 'boundary-tests'
			},
			'test/project-conversation-ownership.test.ts': {
				'project creation excludes another client until the owning request finishes':
					'boundary-tests',
				'visual creation reuses GPT Image and saves a reviewable committed version':
					'boundary-tests'
			}
		},
		playwright: {
			'tests/e2e/ui-agent-creation.spec.ts': ['catalog', 'request', 'conversation'],
			'tests/e2e/compact-agent.spec.ts': ['compact-agent-functions', 'compact-agent-components']
		}
	}
};
