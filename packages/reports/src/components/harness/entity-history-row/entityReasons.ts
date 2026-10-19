import type { EntityReasons, ReasonKind } from '../../../utils/entityReasons';
import { boundedText } from '../../../utils/entityReasons';
import { writingLimits } from '../../../../../../src/utils/writing-limits/writingLimits';

/**
 * What a row of a history says was tried: the attempts of each kind within the limit of one,
 * and an attempt both kinds share once, under the kind that says it first.
 */
export function reasonsTried(reasons: EntityReasons): string[] {
	const of = (kind: ReasonKind) =>
		reasons.attempted
			.filter((tried) => tried.uses.some((use) => use.kind === kind))
			.map((tried) => tried.attempt);
	const first = of('simplification');
	const second = of('performance').filter((attempt) => !first.includes(attempt));
	return [first, second]
		.map((attempts) => boundedText(attempts, writingLimits.attempt).text)
		.filter(Boolean);
}
