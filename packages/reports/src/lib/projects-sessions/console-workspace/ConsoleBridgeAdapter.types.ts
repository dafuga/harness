// @harness-uid u_i4ujwaodpy
import type { RunEvent } from '../../../../../desktop/src/models/DesktopBridge.types';

export interface EventBatch {
	gap?: boolean;
	sequence: number;
	events: Array<{ sequence: number; value: RunEvent }>;
	replay: Record<string, { text: string; detail: string; terminal?: RunEvent }>;
}

/** Thrown for each failure this adapter constructs itself; the message says which one happened. */
export class ConsoleBridgeError extends Error {
	override name = 'ConsoleBridgeError';
}
