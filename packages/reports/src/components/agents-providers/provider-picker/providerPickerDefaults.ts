// @harness-uid u_rdrykga3no
import type { PickerModel } from '../../../../../../src/core/pickerModelTypes';

/** What a picker shows once a provider is chosen: a catalog model and one of its efforts. */
export interface PickerDefault {
	model: string;
	effort: string;
}

/** @pure Claude prefers Opus 5.5 at extra-high effort; any other provider its first catalog model. */
export function pickerDefault(provider: string, choices: PickerModel[]): PickerDefault {
	const opus = choices.find((item) => /opus[\s-]*5[.-]5/i.test(`${item.model} ${item.label}`));
	const next = (provider === 'harness-claude' && opus) || choices[0];
	const xhigh = provider === 'harness-claude' && next?.efforts.includes('xhigh');
	return { model: next?.model ?? '', effort: xhigh ? 'xhigh' : (next?.defaultEffort ?? '') };
}
