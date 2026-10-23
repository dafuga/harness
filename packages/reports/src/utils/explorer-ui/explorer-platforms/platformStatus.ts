import type { PlatformView } from './platformStatus.types';
import type { PlatformEntry } from '../../../../../../src/core/explorer-ui/Platform.types';
/** The four platforms every revision is read for; their names belong to this view. */
export const platformViews: readonly PlatformView[] = [
	{ id: 'web', name: 'Web', icon: 'web' },
	{ id: 'ios', name: 'iOS', icon: 'phone' },
	{ id: 'android', name: 'Android', icon: 'android' },
	{ id: 'desktop', name: 'Desktop (Electron)', icon: 'desktop' }
];
export const unrecorded = 'No platform configuration is recorded at this revision.';
const labels = {
	configured: 'Configured',
	'setup-required': 'Setup required',
	'not-configured': 'Not configured',
	'not-recorded': 'Not recorded'
} as const;
/** What the repository declares for a platform; never whether a deployment of it works. */
export function platformStatus(platform?: PlatformEntry) {
	const id = platform?.status ?? 'not-recorded';
	return { id, label: labels[id] };
}
