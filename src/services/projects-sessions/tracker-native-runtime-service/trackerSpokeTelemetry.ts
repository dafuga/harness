// @harness-uid u_ac655bcttp
import type { TrackerWireValue } from '../TrackerHubSyncService.types';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { machineReport } from './nativeTrackerLinks';

/** A spoke's launcher report, with this computer's resource reading when one is available. */
export async function spokeReport(
	machines: TrackerMachineService,
	report: ReturnType<typeof machineReport>
): Promise<TrackerWireValue> {
	// A failed reading must not stop the launcher report or the run history.
	const resources = await machines.sampleLocal().catch(() => undefined);
	return { ...report, ...(resources && { resources }) } as unknown as TrackerWireValue;
}
