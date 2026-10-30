import { entities, entity } from './explorerData';
import type { PreviewCases } from './shared';

/** Different consumer counts and limits exercise the same real footer component. */
export function explorerUsageVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, consumers: [] };
	if (variant === 'duplicates') return { ...props, consumers: [entity, entity] };
	const consumers = entities.slice(0, 4);
	if (variant === 'many') return { ...props, consumers };
	if (variant === 'limited') return { ...props, consumers, limit: 1 };
	if (variant === 'limit-zero') return { ...props, consumers, limit: 0 };
	return null;
}
