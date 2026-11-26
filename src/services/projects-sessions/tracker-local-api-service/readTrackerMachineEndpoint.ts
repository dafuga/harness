// @harness-uid u_ct2ksrufbk
import { trackerWorkRamGB } from '../../../utils/projects-sessions/placeTrackerWork';
import type { TrackerWorkKind } from '../../../utils/projects-sessions/trackerMachine.types';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerMachineSummary } from '../tracker-machine-service/trackerMachineSummary';
import type { TrackerMachineService } from '../TrackerMachineService';

const maxHistoryHours = 7 * 24;

/** `GET /machines`, `/machines/:name` and `/place`. Other paths are not handled here. */
export function readTrackerMachineEndpoint(
	[root, name, ...rest]: string[],
	query: Record<string, string>,
	machines?: TrackerMachineService
): { status: number; body: unknown } | undefined {
	if (!machines || rest.length) return undefined;
	if (root === 'machines')
		return name
			? machineDetail(machines, name, query.hours)
			: { status: 200, body: machines.rows().map(trackerMachineSummary) };
	return root === 'place' && !name ? placement(machines, query) : undefined;
}

function machineDetail(machines: TrackerMachineService, name: string, rawHours = '24') {
	const hours = Number(rawHours);
	if (!(hours > 0 && hours <= maxHistoryHours))
		return invalid(`hours must be more than 0 and at most ${maxHistoryHours}`);
	const node = canonicalNode(name, {});
	const row = machines.rows().find((candidate) => candidate.node === node);
	if (!row) return { status: 404, body: { error: `no computer named ${name}` } };
	const detail = { ...trackerMachineSummary(row), sample: row.sample };
	return { status: 200, body: { ...detail, history: machines.history(node, hours) } };
}

function placement(machines: TrackerMachineService, query: Record<string, string>) {
	const kind = query.kind ?? 'general';
	if (!Object.hasOwn(trackerWorkRamGB, kind))
		return invalid(`kind must be one of ${Object.keys(trackerWorkRamGB).join(', ')}`);
	const raw = query['needs-ram'];
	const needsRamGB = raw === undefined ? undefined : Number(raw);
	if (needsRamGB !== undefined && !(needsRamGB > 0 && needsRamGB <= 1024))
		return invalid('needs-ram must be a number of GB');
	return { status: 200, body: machines.place({ kind: kind as TrackerWorkKind, needsRamGB }) };
}

function invalid(error: string) {
	return { status: 400, body: { error } };
}
