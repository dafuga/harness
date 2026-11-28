// @harness-uid u_bl6xl2h4a3
import type { TrackerMachineService } from '../TrackerMachineService';

export type PeerStarts = Pick<TrackerMachineService, 'peerStartHold'>;

import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';

export type TrackerFleetRuntime = Pick<TrackerNativeRuntimeService, 'machines' | 'fleetSamples'>;
