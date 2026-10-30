import { activityCatalogVariants } from './activityCatalogVariants';
import { providerPickerStates } from './providerPickerVariants';
import { audioCatalogVariants } from './audioCatalogVariants';

/** Additional representative states stay beside each component's required default state. */
const variants: Record<string, string[]> = {
	...audioCatalogVariants,
	// The console connects on open and exposes its access, roster and composer states.
	'reports.component.console-chat': [
		'open',
		'loading',
		'connection-error',
		'read-only',
		'agents',
		'ask',
		'change',
		'comment',
		'model-open',
		'effort-open'
	],
	// Floating chat exposes its launcher, notice, navigation and conversation-follow modes.
	'reports.component.floating-chat': [
		'closed',
		'notice',
		'navigation',
		'following',
		'not-following'
	],
	// Connection, session, queue and selection branches are exercised through the picker client.
	'reports.component.provider-picker': providerPickerStates,
	// Active observations and every switch status have distinct card presentations.
	'reports.component.provider-picker-cards': [
		'unknown',
		'in-use',
		'applying',
		'applied',
		'failed',
		'cancelled',
		'locked'
	],
	// A single recording, comparison pair and disabled upload each have distinct input layouts.
	'reports.component.audio-upload-files': ['comparison', 'uploading'],
	// Image, missing, compact provenance and paired-audio branches each render different evidence.
	'reports.component.evidence-card': ['missing', 'compact', 'paired-audio'],
	// Media filtering, empty results, upload controls and a lightbox are separate gallery states.
	'reports.component.evidence-grid': ['empty', 'audio', 'uploads', 'image-open'],
	// The default shows two facts; this state proves a fuller recorded provenance set remains legible.
	'reports.component.evidence-provenance': ['extended'],
	// The lightbox needs separate before, compare and unavailable-image examples.
	'reports.component.evidence-viewer': ['before', 'compare', 'unavailable'],
	// Paired results, pending repair, explicit gaps and expanded output are distinct proof states.
	'reports.component.regression-proof': ['pending', 'gap', 'output-open'],
	// Examples distinguish provenance, value shape and the expanded full JSON.
	'reports.component.contract-example': [
		'illustrative',
		'missing',
		'no-description',
		'structure',
		'structure-open',
		'rows',
		'markup',
		'multiple'
	],
	// Contract tables retain empty, compact, unnamed and long-value presentations.
	'reports.component.contract-table': [
		'plain',
		'empty',
		'empty-kept',
		'plain-empty',
		'hide-names',
		'illustrative',
		'missing',
		'long',
		'multiple'
	],
	// Documented and observed cases retain failures, gaps and their expanded source values.
	'reports.component.entity-cases': [
		'empty',
		'expected-error',
		'recorded',
		'recorded-error',
		'observed',
		'observed-noncallable',
		'unavailable',
		'malformed',
		'wrong-unit',
		'expanded'
	],
	// A contract changes for each entity kind, missing declarations, errors and an opened example.
	'reports.component.entity-contract': [
		'empty',
		'errors',
		'last',
		'example-open',
		'function',
		'function-error',
		'service',
		'model',
		'model-bare',
		'types',
		'config'
	],
	// Documentation distinguishes absent examples, setup, missing calls and expected outcomes.
	'reports.component.entity-examples': [
		'empty',
		'gap',
		'setup',
		'inline-setup',
		'missing-setup',
		'error',
		'missing-call',
		'void'
	],
	// Search opens with empty, loading, filtered, selected and revision-pinned presentations.
	'reports.component.entity-search': [
		'open',
		'open-initial',
		'open-loading',
		'open-no-matches',
		'open-second-selected',
		'open-pinned'
	],
	// Search results distinguish typing, loading, no matches and selection changes.
	'reports.component.entity-search-results': [
		'initial',
		'loading',
		'no-matches',
		'second-selected',
		'none-selected',
		'no-purpose'
	],
	'reports.component.explorer-function-card': ['service', 'model', 'no-usage', 'many-usage'],
	// Visual, page, function and unlinked dependency cards each have their own treatment.
	'reports.component.explorer-ui-explorer-module-card': [
		'missing',
		'function',
		'page',
		'page-missing',
		'unlinked'
	],
	// Filters show their inactive trigger by default, with active and opened states separately.
	'reports.component.filter-dialog': ['active', 'open'],
	// Text, image and viewport-filling lightbox dialogs use different presentation rules.
	'reports.component.modal': ['image', 'lightbox'],
	// Archived source distinguishes actionable, loading, unavailable, empty and linked views.
	'reports.component.source-code-action': ['unavailable'],
	'reports.component.source-content': [
		'loading',
		'loading-file',
		'error',
		'list-error',
		'empty',
		'empty-file'
	],
	'reports.component.source-dialog': [
		'loading',
		'loading-file',
		'error',
		'list-error',
		'empty',
		'empty-file'
	],
	'reports.component.source-file-list': ['linked', 'empty'],
	'reports.component.source-viewer': [
		'loading',
		'loading-list',
		'error',
		'list-error',
		'empty',
		'empty-file'
	],
	// Dense, display-label and disabled controls expose the select's distinct field treatments.
	'reports.component.select': ['compact', 'display', 'disabled', 'open'],
	// The default shows a passed badge; each other status is its own example.
	'reports.component.status-badge': [
		'running',
		'failed',
		'blocked',
		'skipped',
		'not-proven',
		'interrupted'
	],
	'reports.component.module-system-explorer-module-resources-screen': ['playwright'],
	'reports.component.module-system-explorer-modules-screen': ['playwright', 'headless-audio'],
	'desktop.component.project-agent': [
		'closed',
		'read-only',
		'local-comment',
		'hosted-comment',
		'comment-retry',
		'conversation',
		'historical',
		'ask',
		'plan',
		'visual-plan',
		'change',
		'no-provider',
		'running',
		'saved-plan',
		'failure',
		'agents-empty',
		'agents-active',
		'agents-unknown',
		'agents-stale',
		'agents-many'
	]
};
export const previewVariants = (id: string): string[] => [
	'',
	...(activityCatalogVariants[id] ?? variants[id] ?? [])
];
export const previewState = (id: string, variant = ''): string =>
	id.replaceAll('.', '-') + (variant ? `-${variant}` : '');
