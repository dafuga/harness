/** Additional activity, analytics and replay states for their dedicated catalog captures. */
export const activityCatalogVariants: Record<string, string[]> = {
	// Live activity keeps unavailable, stale, failed and untracked readings distinct.
	'reports.component.activity-agents': [
		'unavailable',
		'tracking-never-used',
		'stale',
		'failed-read',
		'unreadable',
		'empty-roster',
		'gone',
		'completed',
		'failed',
		'details-open',
		'unstated',
		'many-units',
		'expanded-units',
		'many-agents',
		'expanded-agents'
	],
	// File activity distinguishes the live checkout from recorded, clean, empty and clipped views.
	'reports.component.activity-files': [
		'recorded',
		'clean',
		'empty',
		'truncated',
		'many-uncommitted',
		'expanded-uncommitted',
		'many-committed',
		'expanded-committed',
		'multiple-checkouts'
	],
	// The list preserves its empty, short, ordered, expanded and caller-error presentations.
	'reports.component.activity-list': ['empty', 'short', 'ordered', 'expanded', 'error'],
	// Loop history either lists known templates or explains that none has been recorded.
	'reports.component.activity-loops': ['empty'],
	// Work distinguishes a live checkout from the recorded-history wording and an empty history.
	'reports.component.activity-work': [
		'recorded',
		'empty',
		'details-open',
		'no-reason',
		'truncated',
		'many',
		'expanded'
	],
	// Project activity keeps recorded, empty, stale and failed live readings distinct.
	'reports.component.project-activity': ['recorded', 'empty', 'stale', 'failed-read'],
	// Site activity shows an empty repository, stale reading and failed refresh independently.
	'reports.component.site-activity': ['empty', 'stale', 'failed-refresh'],
	// History filters show focused, empty and fully populated forms.
	'reports.component.analytics-filters': ['empty', 'all-filters'],
	// CPU distinguishes pending, idle, unmeasured and unavailable local samples.
	'reports.component.analytics-cpu': ['loading', 'no-agents', 'not-measured', 'unavailable'],
	// History distinguishes completed, active and absent loops.
	'reports.component.analytics-history': ['empty', 'active'],
	// Unknown model names and unassessed rates stay distinct from empty or measured data.
	'reports.component.analytics-models': ['empty', 'unknown', 'unassessed'],
	// Task history separates empty, unassessed, not-yet-passed and retried assessments.
	'reports.component.analytics-tasks': ['empty', 'unassessed', 'unpassed', 'retried'],
	// Replay covers run status, image loading and failure, playback, export and controls.
	'reports.component.gameplay-replay': [
		'live-empty',
		'live',
		'interrupted',
		'nonportable',
		'download-preparing',
		'loading',
		'image-error',
		'playing',
		'last-frame',
		'ended',
		'waiting-live',
		'fullscreen',
		'speed-open',
		'scene-open'
	],
	// Playback, selected controls and boundary-disabled controls each remain independently inspectable.
	'reports.component.replay-controls': [
		'playing',
		'middle-frame',
		'final-frame',
		'single-frame',
		'no-scenes',
		'scene-unselected',
		'fullscreen',
		'speed-2x',
		'speed-open',
		'scene-open'
	]
};
