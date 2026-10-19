import { MeasuredDefinition, ComparisonVerdict } from '../../utils/comparisonDifferences';
import { comparisonSchema, metricUnits, type Comparison } from "../../core/comparisonTypes";

const note = (same: boolean, difference: string): string[] => (same ? [] : [difference]);

/**
 * Decides whether a measurement may be compared with a baseline. Missing metadata on either
 * side is incomplete and any difference is incompatible; only identical definitions compare.
 */
export function comparisonDifferences(
	metric: string,
	measured: MeasuredDefinition,
	baseline: MeasuredDefinition
): ComparisonVerdict {
	const gaps = [...gapsOf('measurement', measured), ...gapsOf('baseline', baseline)];
	if (gaps.length > 0) return { status: 'incomplete', differences: gaps };
	const differences = [
		...unitDifference(metric, measured.unitOfMeasure, baseline.unitOfMeasure),
		...contextDifferences(
			comparisonSchema.parse(measured.comparison),
			comparisonSchema.parse(baseline.comparison)
		),
		...note(measured.method === baseline.method, 'method description differs from the baseline')
	];
	return { status: differences.length === 0 ? 'comparable' : 'incompatible', differences };
}

function gapsOf(side: string, definition: MeasuredDefinition): string[] {
	const stated = definition.comparison !== undefined && definition.comparison !== null;
	const valid = comparisonSchema.safeParse(definition.comparison).success;
	const context = stated ? 'an invalid comparison context' : 'no comparison context';
	return [
		...note(valid, `the ${side} states ${context}`),
		...note(Boolean(definition.unitOfMeasure), `the ${side} states no unit of measure`),
		...note(Boolean(definition.method), `the ${side} states no method`)
	];
}

function unitDifference(metric: string, measured?: string, baseline?: string): string[] {
	if (measured !== baseline)
		return [`unit of measure is ${measured}, the baseline is in ${baseline}`];
	const expected = metricUnits[metric] ?? measured;
	return note(measured === expected, `unit of measure is ${measured}, ${metric} is in ${expected}`);
}

function contextDifferences(measured: Comparison, baseline: Comparison): string[] {
	const short = (digest: string) => digest.slice(0, 12);
	const taken = ({ warmup, rounds, iterations }: Comparison['sampling']) =>
		`${rounds} rounds of ${iterations} calls after ${warmup} warm-up calls`;
	return [
		...note(
			measured.request === baseline.request,
			`request ${short(measured.request)} differs from the baseline request ${short(baseline.request)}`
		),
		...note(
			measured.boundary === baseline.boundary,
			`measured boundary is ${measured.boundary}, the baseline measured ${baseline.boundary}`
		),
		...note(
			measured.protocol === baseline.protocol,
			`protocol is ${measured.protocol}, the baseline used ${baseline.protocol}`
		),
		...note(
			taken(measured.sampling) === taken(baseline.sampling),
			`sampling is ${taken(measured.sampling)}, the baseline used ${taken(baseline.sampling)}`
		)
	];
}
