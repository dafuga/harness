import type { RunEvent } from '../../../../../desktop/src/models/DesktopBridge.types';

export interface EventBatch {
	gap?: boolean;
	sequence: number;
	events: Array<{ sequence: number; value: RunEvent }>;
	replay: Record<string, { text: string; detail: string; terminal?: RunEvent }>;
}
