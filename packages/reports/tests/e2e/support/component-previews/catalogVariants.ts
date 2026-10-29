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
	// The default shows both recorded clips; this keeps an unavailable side legible on its own.
	'reports.component.audio-comparison': ['unavailable'],
	// The comparison opens by default; each single-recording view stays independently inspectable.
	'reports.component.audio-comparison-viewer': ['before', 'after', 'unavailable'],
	// A recorded clip exposes both its available notes and unavailable fallback separately.
	'reports.component.audio-evidence': ['notes', 'unavailable'],
	// The trigger is a default state; this variant shows its populated search dialog.
	'reports.component.entity-search': ['open'],
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
