import type { WorkItem } from '../../../../../../src/core/activityTypes';
import type { PreviewCases } from './shared';

const subjects = [
	'feat: capture component previews',
	'fix: show the latest activity',
	'feat: document activity contracts',
	'fix: preserve the checkout name',
	'chore: update review fixtures',
	'fix: align activity labels'
];
const prefixes = ['a31db42', 'b04e19f', 'c27d9a1', 'd965e70', 'e1b6c83', 'f25a7d9'];

/** Vary real work rows for the disclosure, omitted detail, and list boundaries. */
export function activityWorkVariant(props: PreviewCases[string], variant: string) {
	const first = (props.work as WorkItem[])[0];
	if (variant === 'details-open') return { ...props };
	if (variant === 'no-reason')
		return { ...props, work: [{ ...first, units: [], unitCount: 0, reasons: [], reasonCount: 0 }] };
	if (variant === 'truncated')
		return { ...props, work: [{ ...first, unitCount: 4, reasonCount: 3 }] };
	if (variant !== 'many' && variant !== 'expanded') return null;
	return {
		...props,
		work: subjects.map((subject, index) => ({
			...first,
			subject,
			commit: prefixes[index].padEnd(40, '0'),
			committedAt: new Date(Date.parse(first.committedAt) - index * 3_600_000).toISOString()
		}))
	};
}
