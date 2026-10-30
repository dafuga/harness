import type { SearchEntry } from '../../../../src/utils/explorer-ui/entitySearch';
import type { PreviewCases } from './shared';

/** The result list reflects the query and active option rather than unrelated catalog entries. */
export function searchResultsVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'initial') return { ...props, query: '', found: [] };
	if (variant === 'loading') return { ...props, loading: true, found: [] };
	if (variant === 'no-matches') return { ...props, query: 'billing', found: [] };
	if (variant === 'second-selected') return { ...props, active: 1 };
	if (variant === 'none-selected') return { ...props, active: -1 };
	if (variant === 'no-purpose') {
		const found = props.found as SearchEntry[];
		return { ...props, found: [{ ...found[0], purpose: '' }] };
	}
	return null;
}
