// @harness-uid u_p5thuojtbt
import type { HarnessCapture, HarnessRecord } from '../../models/explorer-ui/Harness.types';
export interface GalleryCaptureContext {
	capture: HarnessCapture;
	scenario: HarnessRecord['scenarios'][number];
	state: string;
	order: number;
}
