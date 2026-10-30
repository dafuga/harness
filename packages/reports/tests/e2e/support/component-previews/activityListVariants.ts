import { createRawSnippet } from 'svelte';
import type { PreviewCases } from './shared';

/** Supply the list's actual inputs for each independent catalog example. */
export function activityListVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, items: [] };
	if (variant === 'short') return { ...props, items: (props.items as unknown[]).slice(0, 2) };
	if (variant === 'ordered') return { ...props, ordered: true };
	if (variant === 'error')
		return {
			...props,
			items: [{ title: 'Could not read recent activity. Please try again.' }],
			row: createRawSnippet((item: () => { title: string }) => ({
				render: () => `<span role="alert">${item().title}</span>`
			}))
		};
	return props;
}
