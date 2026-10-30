/** Separate gallery, card and proof presentations. */
export const evidenceCatalogVariants: Record<string, string[]> = {
	'reports.component.evidence-card': [
		'missing',
		'compact',
		'paired-audio',
		'compact-closed',
		'image-error',
		'single-audio',
		'minimal',
		'running',
		'failed',
		'blocked',
		'skipped',
		'not-proven',
		'interrupted'
	],
	'reports.component.evidence-grid': ['empty', 'audio', 'uploads', 'image-open'],
	'reports.component.evidence-provenance': ['extended'],
	'reports.component.evidence-viewer': ['before', 'compare', 'unavailable'],
	'reports.component.regression-proof': ['pending', 'gap', 'output-open', 'capture-only', 'empty']
};
