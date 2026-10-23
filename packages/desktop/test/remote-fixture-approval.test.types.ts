import type { startRemoteFixture } from '../scripts/remote-fixture-host';

/**
 * The fixture computer as the native acceptance run uses it: nobody approves by itself. A phone
 * that scanned waits at the real relay Worker until the control is told to approve or deny it.
 */
export type Fixture = Awaited<ReturnType<typeof startRemoteFixture>>;

export interface View {
	requests: { deviceId: string; deviceName: string }[];
	devices: { deviceId: string; name: string; agents: boolean }[];
}
