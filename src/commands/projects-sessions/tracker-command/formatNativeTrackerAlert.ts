// @harness-uid u_r7qgepnoax
import type { NativeTrackerAlertReceipt } from './nativeTrackerCli.types';

export function formatNativeTrackerAlert(receipt: NativeTrackerAlertReceipt): string {
	return receipt.item_id
		? `alert recorded for Chief of Staff on [${receipt.item_id.slice(0, 6)}]`
		: `no item "${receipt.target}": alert kept in the Chief of Staff inbox`;
}
