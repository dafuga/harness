import type { PreviewProps } from './shared.types';
import { noop, text } from './shared';
/** Preserve each former status renderer's realistic catalog inputs under one unit. */
export function statusModeProps(variant: string): PreviewProps | null {
	if (variant === 'badge') return { variant: 'badge', status: 'passed' };
	if (variant.startsWith('badge-')) return { variant: 'badge', status: variant.slice(6) };
	if (variant === 'run' || variant === 'run-idle')
		return {
			variant: 'run',
			label: variant === 'run' ? 'Capturing component screenshots…' : 'Component review completed.',
			children: text('<span>Invoice approval review</span>'),
			active: variant === 'run',
			cancel: noop
		};
	if (!variant.startsWith('icon')) return null;
	const status = variant.slice(5);
	const reasons: Record<string, string> = {
		failed: 'Verification failed: the component test did not finish successfully at this revision.',
		unverified: 'This revision has not been verified. Run the required checks before accepting it.',
		unknown: 'Verification status is unknown: the saved record could not be read or trusted.',
		long: 'The desktop capture passed, but tablet and mobile captures are missing for this revision. Their earlier images predate the current source change and cannot verify this build. Rerun the component catalog at every viewport, retain the original images in history, and inspect them before accepting this revision.'
	};
	const failed = ['failed', 'unverified', 'unknown', 'no-reason', 'long'].includes(status);
	return {
		variant: 'icon',
		status: failed ? status : 'verified',
		reason:
			status === 'no-reason' ? '' : (reasons[status] ?? 'All required component states passed.')
	};
}
