import type { HarnessMark, HarnessUnit } from '../../../models/explorer-ui/Harness.types';

const markLabels: Record<HarnessMark, string> = {
	direct: 'directly changed', indirect: 'indirectly affected', added: 'added', removed: 'removed'
};

/** @pure Describe the unit and its current source-change mark for assistive technology. */
export function mapUnitLabel(unit: HarnessUnit, mark?: HarnessMark): string {
	return `${unit.id}, ${unit.kind}${mark ? `, ${markLabels[mark]}` : ''}`;
}
