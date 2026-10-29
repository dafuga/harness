import type { PreviewCases } from './shared';

const statuses = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

/** Keep each recording's availability, duration and verdict independently represented. */
export function audioComparisonVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'before' || variant === 'after') return props;
	const before = props.before as Record<string, unknown>;
	const after = props.after as Record<string, unknown>;
	if (variant === 'unavailable') return { ...props, before: unavailable(before) };
	if (variant === 'after-unavailable') return { ...props, after: unavailableAfter(after) };
	if (variant === 'both-unavailable')
		return { ...props, before: unavailable(before), after: unavailableAfter(after) };
	if (variant === 'no-duration')
		return {
			...props,
			before: { ...before, durationSeconds: undefined },
			after: { ...after, durationSeconds: undefined }
		};
	if (variant === 'mixed') return { ...props, before: { ...before, status: 'failed' } };
	return statuses.includes(variant) ? { ...props, after: { ...after, status: variant } } : null;
}

function unavailable(item: Record<string, unknown>) {
	return {
		...item,
		file: '',
		missing: true,
		note: 'The original recording was not retained with this evidence.'
	};
}

function unavailableAfter(item: Record<string, unknown>) {
	return {
		...unavailable(item),
		note: 'The updated recording was not retained with this evidence.'
	};
}
