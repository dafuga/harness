import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { PreviewCases } from './shared';
import { translationData } from './translations';
import { ids } from './explorerData';

/** A translation catalog records its own revision's source gaps and literal values. */
export function translationsVariant(props: PreviewCases[string], variant: string) {
	const host = props as unknown as ExplorerScreenProps;
	if (variant === 'unindexed') return { ...props, head: { ...host.head, translations: undefined } };
	if (variant === 'empty')
		return { ...props, head: { ...host.head, translations: { ...translationData, rows: [] } } };
	if (variant === 'gaps' || variant === 'gaps-open')
		return {
			...props,
			head: {
				...host.head,
				translations: {
					...translationData,
					gaps: ['packages/orders/fr.json is unavailable at this revision.']
				}
			}
		};
	if (variant === 'missing-values')
		return {
			...props,
			head: {
				...host.head,
				translations: {
					locales: ['en', 'fr'],
					gaps: [],
					rows: [
						{
							scope: 'orders',
							key: 'ready',
							values: { en: 'Ready to ship' },
							sources: ['orders/en.json'],
							usedBy: [ids.list]
						},
						{
							scope: 'orders',
							key: 'note',
							values: { en: 'Delivery note', fr: '' },
							sources: ['orders/en.json', 'orders/fr.json'],
							usedBy: []
						}
					]
				}
			}
		};
	return props;
}
