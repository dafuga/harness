// @harness-uid u_375c7frogd
import type {
	HarnessScenarioResult,
	HarnessCapture
} from '../../../models/explorer-ui/Harness.types';

export interface Found {
	scenario: HarnessScenarioResult;
	state: string;
	capture: HarnessCapture;
}

export interface Slot {
	key: string;
	scenario: string;
	state: string;
	where: string;
	viewport?: string;
	audio: boolean;
}
