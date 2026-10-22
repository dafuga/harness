import type { VerificationScope } from './verification-targets';

/**
 * The modular H brand contract: its geometry, favicons and shared mark are proved in reports, its
 * native icons in desktop. A scope holds one package, so the two halves are two scenarios.
 */
export const brandingVerificationScopes: Record<string, VerificationScope> = {
	'modular-h-branding-contract': {
		package: 'reports',
		vitest: {
			'test/utils/brand-mark.test.ts': {
				'five equal tiles fill the corners and centre of a square lattice': 'mark-geometry',
				'the favicon draws the five tiles in gold on a navy square': 'mark-geometry',
				'the desktop app serves the shared mark as its favicon': 'favicons',
				'the hub app serves the shared mark as its favicon': 'favicons',
				'the reports app serves the shared mark as its favicon': 'favicons'
			},
			'test/components/brand-mark.test.ts': {
				'the mark is five square tiles in the current colour, decorative by default': 'shared-mark',
				'a labelled mark is an image with that name': 'shared-mark',
				'desktop/src/components/projects-sessions/ProjectGate.svelte compiles to the shared mark, not the old one':
					'shared-surfaces',
				'hub/src/components/shared-primitives/HubFrame.svelte compiles to the shared mark, not the old one':
					'shared-surfaces',
				'reports/src/components/explorer-ui/harness/HarnessHeader.svelte compiles to the shared mark, not the old one':
					'shared-surfaces',
				'reports/src/components/reports-media/ReportView.svelte compiles to the shared mark, not the old one':
					'shared-surfaces',
				'desktop/src/components/projects-sessions/nav-bar/NavBar.svelte compiles to the shared mark, not the old one':
					'shared-surfaces',
				'reports/src/components/explorer-ui/harness/harness-navbar/HarnessNavbar.svelte compiles to the shared mark, not the old one':
					'shared-surfaces'
			}
		},
		playwright: {}
	},
	'modular-h-native-contract': {
		package: 'desktop',
		vitest: {
			'test/utils/brand-icon.test.ts': {
				'the iOS icon is 1024 square, opaque, gold tiles in a modular H on navy': 'native-icons',
				'the Mac icon keeps a transparent margin around its navy plate': 'native-icons',
				'a packaged Mac app is given the named Harness icon': 'mac-packaging'
			}
		},
		playwright: {}
	}
};
