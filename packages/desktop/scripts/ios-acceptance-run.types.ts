import type { AcceptanceRecord } from './ios-acceptance-record';
import type { SimulatorPage } from './ios-acceptance-page';

/** What the control of the TEST ONLY fixture answers about its computer. */
export interface FixtureView {
	state: string;
	locked: boolean | null;
	requests: { deviceId: string; deviceName: string }[];
	devices: { deviceId: string; name: string; online: boolean }[];
}

/** A one-time offer. Its code and its QR text are hidden by the record as soon as it arrives. */
export interface PairingOffer {
	pairingId: string;
	code: string;
	/** The text of the QR code: what a camera would read from the computer. */
	scan: string;
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
