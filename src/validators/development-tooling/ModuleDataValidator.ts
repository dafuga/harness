import type { ModuleValidationInput } from './ModuleDataValidator.types';
import type { ModuleDataValidatorResult } from './ModuleDataValidator.types';
import { explorerCategory } from '../../../packages/reports/src/utils/explorer-ui/explorerCategory';
import { moduleFields } from './module-data-validator/moduleFields';
import { moduleEvidence } from './module-data-validator/moduleEvidence';
/** Required metadata and evidence are independent; unknown never means zero or none. */
export class ModuleDataValidator {
	validate(detail: ModuleValidationInput, tree?: string): ModuleDataValidatorResult {
		const active = detail.registry.units.filter((unit) => unit.status === 'active');
		const known = new Set(active.map((unit) => unit.id));
		return {
			modules: active.map((unit) => ({
				id: unit.id,
				kind: unit.kind,
				category: explorerCategory(unit),
				issues: [
					...moduleFields(unit, known),
					...moduleEvidence(detail, unit, tree).map((issue) => ({
						...issue,
						kind: 'evidence' as const
					}))
				]
			})),
			issues: detail.registry.available ? [] : [detail.registry.gap ?? 'Missing unit registry.']
		};
	}
}
export type { ModuleDataValidatorResult } from './ModuleDataValidator.types';
