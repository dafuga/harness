import type { VerificationScope } from './verification-targets';

/** The search of the shared workspace: its entries as observed assertions, its specs as run. */
export const searchVerificationScopes: Record<string, VerificationScope> = {
	'search-shared-app': {
		package: 'desktop',
		vitest: {
			'test/utils/workspace-search.test.ts': {
				'at the tip every entity is an entry of that commit, with its display name and purpose':
					'search-entries',
				'at a pinned commit the scope names the commit, and each entry carries the full commit':
					'search-entries',
				'while a project or revision is read, nothing of the one shown before is offered':
					'search-entries',
				'a listed result opens in the project, branch and commit it was read at': 'search-entries',
				'a result the shown entries did not list is refused, also one equal to a listed result':
					'search-entries'
			}
		},
		playwright: {
			'tests/e2e/ui-search.spec.ts': ['search-ui'],
			'tests/e2e/ui-search-scope.spec.ts': ['search-ui']
		}
	}
};
