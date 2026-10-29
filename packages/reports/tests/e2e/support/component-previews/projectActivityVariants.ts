import type { PreviewCases } from './shared';
import { noop } from './shared';

/** Retain the supplied live observation while its refresh fails or grows stale. */
export function projectActivityVariant(props: PreviewCases[string], variant: string) {
	const live = props.live as { sampledAt: string };
	return {
		...props,
		reading: {
			now: Date.parse(live.sampledAt) + (variant === 'stale' ? 61_000 : 0),
			failed: variant === 'failed-read',
			refresh: noop
		}
	};
}
