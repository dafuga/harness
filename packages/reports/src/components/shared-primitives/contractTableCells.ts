// @harness-uid u_6ezvhmletj
import type { ContractField } from '../../utils/explorer-ui/contractFields';

/** @pure What a field says about being required, naming a field that does not record it. */
export function requirementLabel(field: ContractField): string {
	if (field.required === true) return 'Required';
	if (field.required === false) return 'Optional';
	return 'Requiredness not recorded';
}

/** @pure A recorded default as source text, or null when the field declares none. */
export function defaultText(field: ContractField): string | null {
	if (field.defaultKind === 'undefined') return 'undefined';
	if (!Object.hasOwn(field, 'default')) return null;
	return JSON.stringify(field.default) ?? String(field.default);
}

/** @pure The dot-separated words of a field name, so a long name can break after each dot. */
export function nameWords(name: string): string[] {
	return name.split('.');
}
