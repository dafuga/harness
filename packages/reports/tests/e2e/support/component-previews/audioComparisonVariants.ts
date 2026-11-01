import type { PreviewCases } from './shared';
import { baselineNarration, releaseNarration } from './reportData';

const statuses = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

/** Keep each recording's availability, duration and verdict independently represented. */
export function audioComparisonVariant(props: PreviewCases[string], variant: string, id: string) {
	if (variant === 'pre-mount') return props;
	if (['before', 'after', 'transcript-closed'].includes(variant))
		return { ...props, before: baselineNarration, after: releaseNarration };
	if (['playing-before', 'playing-after'].includes(variant)) return props;
	const before = props.before as Record<string, unknown>;
	const after = props.after as Record<string, unknown>;
	const compact = id === 'reports.component.audio-comparison-viewer';
	if (variant === 'unavailable') return { ...props, before: unavailable(before, compact) };
	if (variant === 'after-unavailable') return { ...props, after: unavailableAfter(after, compact) };
	if (variant === 'both-unavailable')
		return {
			...props,
			before: unavailable(before, compact),
			after: unavailableAfter(after, compact)
		};
	if (variant === 'no-duration')
		return {
			...props,
			before: { ...before, durationSeconds: undefined },
			after: { ...after, durationSeconds: undefined }
		};
	if (variant === 'mixed') return { ...props, before: { ...before, status: 'failed' } };
	return statuses.includes(variant) ? { ...props, after: { ...after, status: variant } } : null;
}

function unavailable(item: Record<string, unknown>, compact: boolean) {
	return {
		...item,
		file: '',
		missing: true,
		note: compact
			? 'Original file not retained.'
			: 'The original recording was not retained with this evidence.'
	};
}

function unavailableAfter(item: Record<string, unknown>, compact: boolean) {
	return {
		...unavailable(item, compact),
		note: compact
			? 'Updated file not retained.'
			: 'The updated recording was not retained with this evidence.'
	};
}
