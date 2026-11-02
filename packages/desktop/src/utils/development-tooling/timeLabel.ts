// @harness-uid u_f4kksj6lzg
import { timeLabel as sharedTimeLabel } from '$reports/helpers/strings/formatTime';
/** Preserve the public formatter contract while using the shared timestamp implementation. */
export function timeLabel(value: string): string {
	return sharedTimeLabel(value);
}
