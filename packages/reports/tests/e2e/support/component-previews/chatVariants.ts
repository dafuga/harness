import type { PreviewCases } from './shared';
import { text } from './shared';

/** Chat state fixtures stay beside report catalog variants instead of the generic router. */
export function chatVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.console-chat') return variant === 'open' ? props : null;
	if (id !== 'reports.component.floating-chat') return null;
	if (variant === 'closed') return { ...props, open: false };
	if (variant === 'notice') return { ...props, notice: 'Agent suggestions appear when a provider connects.' };
	return variant === 'navigation'
		? {
				...props,
				navigation: text('<nav aria-label="Project chat"><a href="/harness">Project activity</a></nav>')
			}
		: null;
}
