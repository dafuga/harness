export type PickerData = Record<string, unknown>;

export type PickerRpc = (
	method: string,
	params: PickerData,
	options?: PickerData
) => Promise<PickerData>;
