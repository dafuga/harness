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
	},
	'agent-settings': {
		package: 'desktop',
		vitest: {
			'test/adapters/agent-settings.test.ts': {
				'a missing preference defaults to three; each allowed count survives a fresh adapter':
					'preference-storage',
				'malformed or out-of-range stored preferences fall back to three': 'preference-storage',
				'invalid writes preserve the stored preference': 'preference-storage',
				'denied reads use the default and failed writes report failure': 'preference-storage'
			},
			'test/stores/agent-settings.test.ts': {
				'load reads once and a valid preference updates all consumers of the store':
					'preference-storage',
				'invalid preferences are refused and persistence failure stays visible':
					'preference-storage'
			}
		},
		playwright: {
			'tests/e2e/agent-model-choices.spec.ts': ['compact-controls', 'model-picker'],
			'tests/e2e/agent-settings.spec.ts': ['settings'],
			'tests/e2e/agent-settings-availability.spec.ts': ['provider-boundaries', 'model-picker']
		}
	}
};
