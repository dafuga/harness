// @harness-uid u_375c7frogd
import type { HarnessRecord } from '../../../models/explorer-ui/Harness.types';
import type { HarnessCapture } from '../../../models/explorer-ui/Harness.types';

export type Scenario = HarnessRecord['scenarios'][number];

export interface Found {
	scenario: Scenario;
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
