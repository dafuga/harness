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
		'unknown-object',
		'schema-array',
		'single-array',
		'single-object',
		'long-key',
		'disclosure-focused',
		'disclosure-hovered',
		'expression',
		'long-expression'
	]
};

/** Preserve the source as written; fixtures never execute a config expression. */
export function configValueVariant(props: PreviewCases[string], variant: string) {
	const node = props.node as ConfigValueNode;
	const detail = configDetailVariant(variant);
	if (detail) return { ...props, node: detail };
	if (['expanded', 'disclosure-focused', 'disclosure-hovered'].includes(variant)) return props;
	if (['object', 'object-expanded'].includes(variant) && node.kind === 'array')
		return { ...props, node: node.entries[0].node };
	if (['empty-array', 'empty-object'].includes(variant)) {
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
	return unresolvedConfigVariant(props, variant);
}

function unresolvedConfigVariant(props: PreviewCases[string], variant: string) {
	if (['unknown-array', 'schema-array'].includes(variant))
		return {
			...props,
			node: {
				kind: 'array',
				source: 'deliverySteps',
				entries: [],
				...(variant === 'schema-array' ? { schema: true } : {})
			}
		};
	if (['expression', 'long-expression'].includes(variant))
		return {
			...props,
			node: {
				kind: 'expression',
				source: variant === 'expression' ? configRemoteExpression : configExpression(commits.middle)
			}
		};
	return null;
}

/** Singular counts, unknown object contents and long source keys retain their real values. */
function configDetailVariant(variant: string): ConfigValueNode | undefined {
	const values: Record<string, ConfigValueNode> = {
		'unknown-object': { kind: 'object', source: 'deliveryPreferences', entries: [] },
		'single-array': {
			kind: 'array',
			source: '["Ship"]',
			count: 1,
			entries: [{ name: '0', node: { kind: 'expression', source: '"Ship"' } }]
		},
		'single-object': {
			kind: 'object',
			source: '{ defaultRegion: "ca" }',
			count: 1,
			entries: [{ name: 'defaultRegion', node: { kind: 'expression', source: '"ca"' } }]
		},
		'long-key': {
			kind: 'object',
			source: '{ maximumConsecutiveDeliveryAttemptsBeforeRetryingShipment: 3 }',
			count: 1,
			entries: [
				{
					name: 'maximumConsecutiveDeliveryAttemptsBeforeRetryingShipment',
					node: { kind: 'expression', source: '3' }
				}
			]
		}
	};
	return values[variant];
}
