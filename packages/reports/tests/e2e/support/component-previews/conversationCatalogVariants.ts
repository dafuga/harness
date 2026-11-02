import { providerPickerStates } from './providerPickerVariants';

export const conversationCatalogVariants: Record<string, string[]> = {
	// The console connects on open and exposes its access, roster and composer states.
	'reports.component.console-chat': [
		'open',
		'populated',
		'loading',
		'connection-error',
		'read-only',
		'agents',
		'ask',
		'change',
		'comment',
		'model-open',
		'model-selected',
		'effort-open',
		'effort-selected'
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
	]
};
