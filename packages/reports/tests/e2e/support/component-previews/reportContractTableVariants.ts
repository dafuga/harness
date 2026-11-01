import type {
	ContractField,
	ContractGroup
} from '../../../../src/utils/explorer-ui/contractFields';
import type { PreviewCases } from './shared';

const longField: ContractField = {
	name: 'OrderStore.find.customerAccountIdentifier',
	type: 'CustomerAccountIdentifier | undefined',
	required: false,
	description: 'The customer account whose order is being retrieved.',
	source: 'declared',
	examples: [{ form: 'literal', value: 'account-42', text: '"account-42"' }]
};

/** Table states preserve their field provenance and the host's empty-group policy. */
export function contractTableVariant(props: PreviewCases[string], variant: string) {
	const group = props.group as ContractGroup;
	const field = group.fields[0];
	if (variant === 'plain') return { ...props, plain: true };
	if (variant === 'empty') return { ...props, group: { ...group, fields: [] } };
	if (variant === 'empty-kept')
		return { ...props, group: { ...group, fields: [], keepEmpty: true } };
	if (variant === 'plain-empty') return { ...props, plain: true, group: { ...group, fields: [] } };
	if (variant === 'hide-names')
		return { ...props, group: { ...group, id: 'outputs', title: 'Returns', hideNames: true } };
	if (variant === 'illustrative')
		return {
			...props,
			group: {
				...group,
				fields: [
					{ ...field, source: 'illustrative', examples: [{ form: 'literal', value: 1, text: '1' }] }
				]
			}
		};
	if (variant === 'missing')
		return {
			...props,
			group: {
				...group,
				fields: [
					{
						name: 'orderStore',
						type: 'OrderStore',
						required: true,
						source: 'missing',
						examples: []
					}
				]
			}
		};
	if (variant === 'long') return { ...props, group: { ...group, fields: [longField] } };
	if (variant === 'multiple') return { ...props, group: { ...group, fields: [field, longField] } };
	return ({ focused: props, hovered: props } as Record<string, PreviewCases[string]>)[variant];
}
