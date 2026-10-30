/** Additional activity, analytics and replay states for their dedicated catalog captures. */
export const activityCatalogVariants: Record<string, string[]> = {
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
	// Project activity keeps recorded, empty, stale and failed live readings distinct.
	'reports.component.project-activity': ['recorded', 'empty', 'stale', 'failed-read'],
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
	// Task history separates empty, unassessed, not-yet-passed and retried assessments.
	'reports.component.analytics-tasks': ['empty', 'unassessed', 'unpassed', 'retried'],
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
	]
};
