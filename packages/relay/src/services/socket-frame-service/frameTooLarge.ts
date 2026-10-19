import { remoteLimits } from "../../../../remote/src/index";

const encoder = new TextEncoder();

/** Whether a frame is longer than the limit, counted in bytes of UTF-8. */
export function frameTooLarge(
	message: string | ArrayBuffer,
	limit: number = remoteLimits.frameBytes
): boolean {
	if (typeof message !== 'string') return message.byteLength > limit;
	if (message.length > limit) return true;
	if (message.length * 3 <= limit) return false;
	return encoder.encode(message).byteLength > limit;
}
