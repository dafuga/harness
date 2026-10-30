import type { ConfigValueNode } from '../../../../../../src/utils/explorer-ui/unitMetadata';
import { configExpression, configRemoteExpression } from '../../../../test/entityConfigFixtures';
import { commits } from '../../../../test/entityUnits';
import type { PreviewCases } from './shared';

/** Config source values have independent collection, expression and disclosure states. */
export const configValueCatalogVariants: Record<string, string[]> = {
	'reports.component.explorer-ui-config-value-tree': [
		'expanded',
		'object',
		'object-expanded',
		'empty-array',
		'empty-object',
		'unknown-array',
		'schema-array',
		'expression',
		'long-expression'
	]
};

/** Preserve the source as written; fixtures never execute a config expression. */
export function configValueVariant(props: PreviewCases[string], variant: string) {
	const node = props.node as ConfigValueNode;
	if (variant === 'expanded') return props;
	if ((variant === 'object' || variant === 'object-expanded') && node.kind === 'array')
		return { ...props, node: node.entries[0].node };
	if (variant === 'empty-array' || variant === 'empty-object') {
		const object = variant === 'empty-object';
		return {
			...props,
			node: {
				kind: object ? 'object' : 'array',
				source: object ? '{}' : '[]',
				count: 0,
				entries: []
			}
		};
	}
	if (variant === 'unknown-array' || variant === 'schema-array')
		return {
			...props,
			node: {
				kind: 'array',
				source: 'deliverySteps',
				entries: [],
				...(variant === 'schema-array' ? { schema: true } : {})
			}
		};
	if (variant === 'expression' || variant === 'long-expression')
		return {
			...props,
			node: {
				kind: 'expression',
				source: variant === 'expression' ? configRemoteExpression : configExpression(commits.middle)
			}
		};
	return null;
}
