import type { Evidence } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';

/** Model the owning gallery's selection callbacks without drawing another component. */
export function evidenceViewerState(props: PreviewCases[string]) {
	let selected = $state(props.selected as Evidence | null);
	return {
		...props,
		get selected() {
			return selected;
		},
		onselect: (item: Evidence) => (selected = item),
		onclose: () => (selected = null)
	};
}
