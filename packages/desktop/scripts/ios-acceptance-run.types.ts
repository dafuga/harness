// @harness-uid u_fppws53qsn
import type { AcceptanceRecord } from './ios-acceptance-record';
import type { SimulatorPage } from './ios-acceptance-page';

export class FixtureControlOriginError extends Error {
	override name = 'FixtureControlOriginError';
}

export class FixtureControlRefusedError extends Error {
	override name = 'FixtureControlRefusedError';
}

/** What the control of the TEST ONLY fixture answers about its computer. */
export interface FixtureView {
	state: string;
	locked: boolean | null;
	requests: { deviceId: string; deviceName: string }[];
	devices: { deviceId: string; name: string; online: boolean }[];
}

/** TEST ONLY. Everything one phase of the native acceptance run works with. */
export interface Acceptance {
	record: AcceptanceRecord;
	page: SimulatorPage;
	udid: string;
	/** The control of the run's own fixture; always on this machine. */
	controlOrigin: string;
	project: { id: string; name: string };
	/** Where screenshots and the report go; ignored by Git. */
	output: string;
}
