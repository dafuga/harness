import type { VerificationScope } from './verification-targets';

/** Shells in the shared app: routing and planning as observed assertions, renderer specs as run. */
export const shellsVerificationScopes: Record<string, VerificationScope> = {
	'shells-shared-app': {
		package: 'desktop',
		vitest: {
			'test/shells-category.test.ts': {
				'a unit declared a shell is a Shell, and every other kind stays where it was':
					'shells-routing',
				'a shell has a workspace address with its project, branch, commit and section':
					'shells-routing',
				'an old Components address of a shell opens it under Shells, keeping its section':
					'shells-routing',
				'at a commit that recorded it as a component, its Components address stays':
					'shells-routing',
				'plans and agent requests may name Shells, and a shell plan needs the image capability':
					'shells-routing',
				'the shared app has seven categories, Shells after Pages': 'shells-routing'
			},
			'test/shells-planning.test.ts': {
				'a shell plan is visual: it is planned for the desktop viewport under Shells':
					'shells-planning',
				'an agent asked from Shells proposes a shell, and it is planned with an image':
					'shells-planning'
			}
		},
		playwright: {
			'tests/e2e/ui-shells.spec.ts': ['shells-ui'],
			'tests/e2e/ui-shells-hosted.spec.ts': ['shells-ui']
		}
	}
};
