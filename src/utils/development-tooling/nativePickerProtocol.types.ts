// @harness-uid u_wjuptfssn5
export type PickerData = Record<string, unknown>;

export type PickerRpc = (
	method: string,
	params: PickerData,
	options?: PickerData
) => Promise<PickerData>;

/** A model selection with no provider: not a string, or a claude- model besides claude-opus-5-5. */
export class UnsupportedModelSelectionError extends Error {
	override name = 'UnsupportedModelSelectionError';
}
