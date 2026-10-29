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
	// The default shows both recorded clips; this keeps an unavailable side legible on its own.
	'reports.component.audio-comparison': ['unavailable'],
	// The comparison opens by default; each single-recording view stays independently inspectable.
	'reports.component.audio-comparison-viewer': ['before', 'after', 'unavailable'],
	// A recorded clip exposes both its available notes and unavailable fallback separately.
	'reports.component.audio-evidence': ['notes', 'unavailable'],
	// A single recording, comparison pair and disabled upload each have distinct input layouts.
	'reports.component.audio-upload-files': ['comparison', 'uploading'],
	// Image, missing, compact provenance and paired-audio branches each render different evidence.
	'reports.component.evidence-card': ['missing', 'compact', 'paired-audio'],
	// Media filtering, empty results, upload controls and a lightbox are separate gallery states.
	'reports.component.evidence-grid': ['empty', 'audio', 'uploads', 'image-open'],
	// The trigger is a default state; this variant shows its populated search dialog.
	'reports.component.entity-search': ['open'],
	// Filters show their inactive trigger by default, with active and opened states separately.
	'reports.component.filter-dialog': ['active', 'open'],
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
