import type { PreviewCases } from './shared';

/** Search opens against a loading source or a specific recorded revision when requested. */
export function entitySearchVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'open-loading') return { ...props, entries: null };
	if (variant === 'open-pinned')
		return { ...props, scope: { label: 'Commit 7561ee4', pinned: '7561ee4' } };
	return props;
}
