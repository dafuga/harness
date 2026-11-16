// @harness-uid u_3cnh273kui
/**
 * A native picker request the bridge cannot complete: a provider change that needs the chat
 * closed or reopened, or a model list that is not an array.
 */
export class NativePickerError extends Error {
	override name = 'NativePickerError';
}
