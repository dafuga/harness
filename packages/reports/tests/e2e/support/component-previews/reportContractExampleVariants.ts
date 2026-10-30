import type { ContractField } from '../../../../src/utils/explorer-ui/contractFields';
import type { PreviewCases } from './shared';

const order = { id: 'A-1048', status: 'Ready to ship', items: 2 };
const orders = [order, { id: 'A-1047', status: 'Delivered', items: 1 }];

function structured(value: unknown): ContractField {
	return {
		name: 'order',
		type: Array.isArray(value) ? 'Order[]' : 'Order',
		description: 'The order data returned by the service.',
		source: 'declared',
		examples: [{ form: 'structure', value, text: JSON.stringify(value, null, 2) }]
	};
}

/** Actual field examples retain their source and form instead of inventing a test result. */
export function contractExampleVariant(props: PreviewCases[string], variant: string) {
	const field = props.field as ContractField;
	if (variant === 'illustrative')
		return {
			...props,
			field: {
				...field,
				source: 'illustrative',
				examples: [{ form: 'literal', value: 1, text: '1' }]
			}
		};
	if (variant === 'missing')
		return {
			...props,
			field: {
				...field,
				name: 'orderStore',
				type: 'OrderStore',
				description: 'The store that reads and updates orders.',
				source: 'missing',
				examples: []
			}
		};
	if (variant === 'no-description')
		return { ...props, field: { ...field, description: undefined } };
	if (variant === 'structure' || variant === 'structure-open')
		return { ...props, field: structured(order) };
	if (variant === 'rows') return { ...props, field: structured(orders) };
	if (variant === 'markup')
		return {
			...props,
			field: {
				...field,
				name: 'button',
				type: 'markup',
				description: 'The button rendered for an order.',
				examples: [
					{
						form: 'markup',
						value: '<button>Save order</button>',
						text: '<button>Save order</button>'
					}
				]
			}
		};
	if (variant === 'multiple')
		return {
			...props,
			field: {
				...field,
				examples: [
					{ form: 'literal', value: 90, text: '90' },
					{ form: 'literal', value: 120, text: '120' }
				]
			}
		};
	return null;
}
