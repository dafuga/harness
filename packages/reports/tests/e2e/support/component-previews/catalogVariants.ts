/** Additional representative states stay beside each component's required default state. */
const variants: Record<string, string[]> = {
	// Live activity keeps unavailable, stale, failed and untracked readings distinct.
	'reports.component.activity-agents': [
		'unavailable',
		'tracking-never-used',
		'stale',
		'failed-read',
		'unreadable'
	],
	// File activity distinguishes the live checkout from recorded, clean, empty and clipped views.
	'reports.component.activity-files': ['recorded', 'clean', 'empty', 'truncated'],
	// Loop history either lists known templates or explains that none has been recorded.
	'reports.component.activity-loops': ['empty'],
	// Work distinguishes a live checkout from the recorded-history wording and an empty history.
	'reports.component.activity-work': ['recorded', 'empty'],
	// Project activity keeps checkout observations, recorded history and no activity distinct.
	'reports.component.project-activity': ['recorded', 'empty'],
	// Site activity's refresh failure preserves the last known live observation with a warning.
	'reports.component.site-activity': ['failed-refresh'],
	// History filters show both a focused query and the no-filter form.
	'reports.component.analytics-filters': ['empty'],
	// CPU distinguishes a healthy idle checkout from an unavailable local sample.
	'reports.component.analytics-cpu': ['no-agents', 'unavailable'],
	// History retains independent empty tables and summaries after filters remove every loop.
	'reports.component.analytics-history': ['empty'],
	// Model usage has a separate unrecorded state from populated author and evaluator evidence.
	'reports.component.analytics-models': ['empty'],
	// Task history distinguishes recorded assessment rows from both empty check sections.
	'reports.component.analytics-tasks': ['empty'],
	// Each side can be unavailable, have no duration or carry an independent result.
	'reports.component.audio-comparison': [
		'unavailable',
		'after-unavailable',
		'both-unavailable',
		'no-duration',
		'mixed',
		'running',
		'failed',
		'blocked',
		'skipped',
		'not-proven',
		'interrupted'
	],
	// Selection, playback, disclosures, availability and independent results are visible states.
	'reports.component.audio-comparison-viewer': [
		'before',
		'after',
		'unavailable',
		'after-unavailable',
		'both-unavailable',
		'no-duration',
		'mixed',
		'running',
		'failed',
		'blocked',
		'skipped',
		'not-proven',
		'interrupted',
		'transcript-closed',
		'playing-before',
		'playing-after'
	],
	// Playback, disclosures, media failures and each recorded result are separate states.
	'reports.component.audio-evidence': [
		'notes',
		'unavailable',
		'notes-closed',
		'notes-transcript',
		'transcript-closed',
		'no-details',
		'no-duration',
		'audio-error',
		'playing',
		'running',
		'failed',
		'blocked',
		'skipped',
		'not-proven',
		'interrupted'
	],
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
	// A single recording, comparison pair and disabled upload each have distinct input layouts.
	'reports.component.audio-upload-files': ['comparison', 'uploading'],
	// Image, missing, compact provenance and paired-audio branches each render different evidence.
	'reports.component.evidence-card': ['missing', 'compact', 'paired-audio'],
	// Media filtering, empty results, upload controls and a lightbox are separate gallery states.
	'reports.component.evidence-grid': ['empty', 'audio', 'uploads', 'image-open'],
	// A replay can wait for its first live frame or retain an interrupted final run.
	'reports.component.gameplay-replay': ['live-empty', 'interrupted'],
	// Playback, selected controls and boundary-disabled controls each remain independently inspectable.
	'reports.component.replay-controls': [
		'playing',
		'final-frame',
		'single-frame',
		'scene-unselected',
		'fullscreen',
		'speed-2x'
	],
	// The default shows two facts; this state proves a fuller recorded provenance set remains legible.
	'reports.component.evidence-provenance': ['extended'],
	// The lightbox needs separate before, compare and unavailable-image examples.
	'reports.component.evidence-viewer': ['before', 'compare', 'unavailable'],
	// Paired results, pending repair, explicit gaps and expanded output are distinct proof states.
	'reports.component.regression-proof': ['pending', 'gap', 'output-open'],
	// Documented and observed cases retain failures, gaps and their expanded source values.
	'reports.component.entity-cases': [
		'empty',
		'expected-error',
		'recorded',
		'recorded-error',
		'observed',
		'unavailable',
		'malformed',
		'wrong-unit',
		'expanded'
	],
	// The trigger is a default state; this variant shows its populated search dialog.
	'reports.component.entity-search': ['open'],
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
	'reports.component.source-dialog': ['loading', 'error', 'empty'],
	'reports.component.source-file-list': ['linked', 'empty'],
	'reports.component.source-viewer': ['loading', 'error', 'empty'],
	// Dense, display-label and disabled controls expose the select's distinct field treatments.
	'reports.component.select': ['compact', 'display', 'disabled'],
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
export const previewVariants = (id: string): string[] => ['', ...(variants[id] ?? [])];
export const previewState = (id: string, variant = ''): string =>
	id.replaceAll('.', '-') + (variant ? `-${variant}` : '');
