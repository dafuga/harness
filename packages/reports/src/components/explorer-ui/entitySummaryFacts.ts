import type { EntityMeasure, PerformanceRow } from '../../utils/explorer-ui/entityMeasure.types';
import type { SummaryFact } from './entitySummaryFacts.types';
import { notMeasured } from '../../utils/explorer-ui/entityMeasure';
/** @pure The workload's declared target and profile, without inventing an environment. */
export const measurementLocation = (row: PerformanceRow): string =>
	[row.target, row.profile].filter(Boolean).join(' · ') || '—';
/** @pure Definition rows in the same order and context as the performance profile. */
export function entitySummaryFacts(measure: EntityMeasure, compact: boolean): SummaryFact[] {
	const primary = measure.performance.find(
		(row) => /latency|navigation|^p\d|duration|time/i.test(row.metric) && row.value !== notMeasured
	);
	const memory = measure.performance.find(
		(row) =>
			/memory|heap|rss/i.test(row.metric) &&
			(!primary ||
				(row.workload === primary.workload &&
					row.target === primary.target &&
					row.profile === primary.profile))
	);
	const rows: SummaryFact[] = [];
	for (let index = 0; index < measure.size.length; index++) {
		const row = measure.size[index];
		if (row.target !== 'none')
			rows.push({
				label: row.label,
				value: row.value,
				title: row.note,
				note: row.note && (!compact || row.value === notMeasured) ? row.note : undefined,
				className: row.value === notMeasured ? 'unmeasured' : ''
			});
	}
	if (compact) return rows.concat([brief('Latency', primary), brief('Memory', memory)]);
	if (measure.performance.length === 0) return rows.concat([brief('Latency'), brief('Memory')]);
	if (measure.performance.length === 1)
		return rows.concat(performanceFacts(measure.performance[0]));
	return rows;
}
/** @pure One compact measurement with an explicit unmeasured state. */
function brief(label: string, row?: PerformanceRow): SummaryFact {
	return {
		label,
		value: row?.value ?? notMeasured,
		title: row?.note,
		className: row ? '' : 'unmeasured'
	};
}
/** @pure Detailed workload facts for the single-row profile. */
function performanceFacts(row: PerformanceRow): SummaryFact[] {
	const location = measurementLocation(row);
	return [
		{ label: 'Workload', value: row.workload, className: '' },
		{ label: 'Environment', value: location, className: location === '—' ? 'unmeasured' : '' },
		{
			label: row.metric,
			value: row.value,
			title: row.note,
			note: row.note,
			className: row.value === notMeasured ? 'unmeasured' : ''
		},
		{
			label: 'Tolerance',
			value: row.tolerance + (row.over ? ' · above the 5% policy' : ''),
			className: row.over ? 'over' : ''
		}
	];
}
