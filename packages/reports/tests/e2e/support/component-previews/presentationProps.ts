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
					name: variant === 'long' ? 'customerRevisionIdentifier'.repeat(12) : field.name,
					description: variant === 'missing-description' ? undefined : field.description
				}));
	return { ...props, contract: { ...contract, inputs, outputs: [], errors: [] } };
}
