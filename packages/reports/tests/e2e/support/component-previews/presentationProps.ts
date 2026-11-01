import { compatibilityVariant } from './compatibilityVariants';
import { explorerTableVariant } from './explorerTableVariants';
import type { EntityContract } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
import type { PreviewCases } from './shared';

const prefix = 'reports.component.shared-primitives-';
/** Presentation changes use the normal catalog inputs, never a second implementation unit. */
export function presentationVariant(id: string, props: PreviewCases[string], variant: string) {
	const compatibility = compatibilityVariant(id, props, variant);
	if (compatibility) return compatibility;
	if (
		id.startsWith(prefix) &&
		['data-table', 'code-line', 'detail-list'].some((name) => id === prefix + name)
	)
		return props;
	if (id === 'reports.component.harness-explorer-table')
		return explorerTableVariant(props, variant);
	if (id !== 'desktop.component.contract-panel') return null;
	if (variant === 'technical-open') return props;
	const contract = props.contract as EntityContract;
	const inputs =
		variant === 'empty'
			? []
			: contract.inputs.map((field) => ({
					...field,
					name: variant === 'long' ? `${field.name}ForCustomerAccountRevisionHistory` : field.name,
					description: variant === 'missing-description' ? undefined : field.description
				}));
	return { ...props, contract: { ...contract, inputs, outputs: [], errors: [] } };
}

/** A callable contract uses authored input metadata and declared return/error types. */
export const contractPanelPreview = {
	inputs: [
		{
			name: 'filterOrders.orders',
			type: 'Order[]',
			required: true,
			description: 'Orders to filter.'
		},
		{
			name: 'filterOrders.searchText',
			type: 'string',
			required: false,
			default: '',
			description: 'Text matched against order identifiers.'
		}
	],
	outputs: [
		{
			name: 'filterOrders.matches',
			type: 'Order[]',
			description: 'Orders matching the search text.'
		}
	],
	errors: [
		{
			name: 'filterOrders.invalidOrders',
			type: 'TypeError',
			description: 'Orders must be an array.'
		}
	],
	hash: null
};
