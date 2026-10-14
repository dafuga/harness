import type { VerificationScope } from './verification-targets';

/** The hosted reader of design options, over versions the real planning package wrote to Git. */
export const hubDesignVerificationScopes: Record<string, VerificationScope> = {
	'hosted-design-options': {
		package: 'hub',
		vitest: {
			'test/utils/hub-design-options.test.ts': {
				'every option keeps its direction, exact prompts, generator and own images':
					'options-projection',
				'a version keeps the exact earlier image it revises': 'options-projection',
				'the approval of option 2 is current, binds option 2 alone, and approves the plan':
					'selected-approval',
				'an approval of every image, naming no option, approves no option of the version':
					'selected-approval',
				'an approval naming option 2 with the images of option 1 approves nothing':
					'selected-approval',
				'a single design keeps its flat images, no options, and its approval of every image':
					'legacy',
				'stored options that claim one image twice are refused': 'corrupt-records',
				'stored options that leave an image unclaimed are refused': 'corrupt-records',
				'stored options that bind a foreign hash are refused': 'corrupt-records',
				'stored options that skip an option id are refused': 'corrupt-records'
			},
			'test/utils/hub-design-region.test.ts': {
				'a revision rectangle reaching the right and bottom edges is kept exactly':
					'options-projection',
				'a revision rectangle that has no width is refused': 'corrupt-records',
				'a revision rectangle that has no height is refused': 'corrupt-records',
				'a revision rectangle that passes the right edge is refused': 'corrupt-records',
				'a revision rectangle that passes the bottom edge is refused': 'corrupt-records'
			},
			'test/utils/hub-design-options-flat.test.ts': {
				'a version of options listing one flat image twice is refused': 'corrupt-records'
			},
			'test/utils/hub-design-options-corrupt.test.ts': {
				'options whose directions differ only by case and spacing are refused': 'corrupt-records',
				'two options holding one picture under two files are refused': 'corrupt-records',
				'an option prompt whose file no longer hashes to its record is refused': 'corrupt-records'
			},
			'test/utils/hub-design-headless.test.ts': {
				'a headless version keeps its notes, has no image or option, and its approval is current':
					'headless',
				'an approval of other notes approves nothing': 'headless'
			},
			'test/utils/hub-options.test.ts': {
				'options that divide the images exactly pass, and a single design passes as it was':
					'options-projection',
				'an image names the option holding it, and a single design names none':
					'options-projection',
				'a revision keeps the fields the desktop reads, and nothing is said when there is none':
					'options-projection',
				'options that share one image are refused as a corrupt artifact': 'corrupt-records',
				'options that leave an image unclaimed are refused as a corrupt artifact':
					'corrupt-records',
				'options that bind another hash are refused as a corrupt artifact': 'corrupt-records',
				'options that start at another id are refused as a corrupt artifact': 'corrupt-records',
				'options that claim a file the version does not hold are refused as a corrupt artifact':
					'corrupt-records'
			}
		},
		playwright: {}
	}
};
