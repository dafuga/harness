import type { VerificationScope } from './verification-targets';

/** Design options: the desktop runs and views of them, and the planning storage that keeps them. */
export const designOptionVerificationScopes: Record<string, VerificationScope> = {
	'design-options': {
		package: 'desktop',
		vitest: {
			'test/design-options-run.test.ts': {
				'a page Plan generates three separately directed options and commits them once':
					'option-plan-runs',
				'a Plan that asks for two options generates two': 'option-plan-runs',
				'a failed option leaves no version and no design commit': 'option-plan-runs',
				'a Plan cancelled during an option leaves no version and no design commit':
					'option-plan-runs',
				'a headless Plan keeps notes and generates no image, whatever count it is given':
					'option-plan-runs',
				'visual provenance stores actual image orchestration model and exact full generator prompt':
					'option-plan-runs'
			},
			'test/design-options-creation.test.ts': {
				'a new visual plan is made as three separately directed options in one version':
					'option-creation',
				'a new visual plan asked for two options from a headless catalog makes two':
					'option-creation',
				'a new headless plan makes no image whatever count it is given': 'option-creation',
				'a failed option of a new plan saves no version and names the draft it made':
					'option-creation'
			},
			'test/design-options-validation.test.ts': {
				'a Plan payload keeps a count from 1 to 10 and refuses any other': 'option-validation',
				'a Change payload names at most one option o1 to o10 and asks for no count':
					'option-validation',
				'a creation payload keeps a count from 1 to 10 and refuses any other': 'option-validation',
				'a revised single design is changed from a thread on its approved version, as before options':
					'option-validation',
				'a Change of an approved option comes only from that option or an unanchored thread':
					'option-validation',
				'a Change that names another option than the approval, or none, is refused':
					'option-validation'
			},
			'test/utils/design-count.test.ts': {
				'a Plan that states no count makes three options, and a stated count from 1 to 10 is kept':
					'option-validation',
				'a count that is not a whole number from 1 to 10 is refused': 'option-validation',
				'a Change that asks for design options is refused': 'option-validation'
			},
			'test/utils/design-directions.test.ts': {
				'each count has its own number of distinct directions': 'option-plan-runs'
			}
		},
		playwright: {}
	},
	'design-options-ui': {
		package: 'desktop',
		vitest: {},
		playwright: {
			'tests/e2e/ui-design-options.spec.ts': [
				'thread-count',
				'thread-default',
				'comment-count',
				'creation-count',
				'headless-count',
				'legacy',
				'option-fit'
			],
			'tests/e2e/ui-design-options-review.spec.ts': [
				'options',
				'selected-option',
				'approve',
				'option-thread',
				'pinned',
				'shared'
			]
		}
	},
	'design-option-storage': {
		package: 'planning',
		vitest: {
			'test/design-options.test.ts': {
				'a version keeps every requested option as its own identity, committed once':
					'option-binding',
				'approving one option binds that option alone; binding two is refused': 'option-binding',
				'0 options are refused, and nothing is committed': 'option-binding',
				'11 options are refused, and nothing is committed': 'option-binding',
				'options that are one image copied are refused, and nothing is committed': 'option-binding',
				'a thread anchors one exact image of one option': 'option-binding',
				'a single design written without options reads and approves as before': 'option-binding'
			},
			'test/utils/plan-options.test.ts': {
				'a single design is written as before, with no options and unprefixed files':
					'option-storage',
				'options are numbered within the version and keep direction, prompt and provenance':
					'option-storage',
				'flat images beside options must be exactly their union': 'option-storage',
				'options must differ in direction, and an option needs images': 'option-storage',
				'a stored version whose options do not divide its images exactly is refused':
					'option-storage',
				'an approval binds one option, a single design binds all, and membership is stored':
					'option-storage',
				'a stored file held by two options, or twice by one, or a blank direction or provenance is refused':
					'option-storage'
			}
		},
		playwright: {}
	}
};
