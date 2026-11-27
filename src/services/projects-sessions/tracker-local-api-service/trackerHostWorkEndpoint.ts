// @harness-uid u_mmvpekjzrl
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerHostWork } from '../../../utils/projects-sessions/trackerHostWork';
import type { TrackerMachineService } from '../TrackerMachineService';
import { trackerResponse } from './trackerLocalResponse';

export async function trackerHostWorkEndpoint(request: Request, machines: TrackerMachineService) {
	const { method } = request;
	if (method !== 'POST' && method !== 'DELETE')
		return trackerResponse(405, { error: 'host work requires POST or DELETE' });
	const body: unknown = await request.json().catch(() => null);
	request.signal.throwIfAborted();
	const claim = trackerHostWork.claim.safeParse(body).data;
	if (!claim) return trackerResponse(400, { error: 'invalid run host work claim' });
	const host = canonicalNode(claim.host, {});
	if (host === machines.store.node || !trackerFleetNodes.includes(host))
		return trackerResponse(400, { error: 'host work requires another fleet computer' });
	const recorded = machines.updateHostWork({ ...claim, host }, method === 'DELETE');
	return recorded
		? trackerResponse(200, { ok: true })
		: trackerResponse(409, { error: 'host work requires an active local run and matching lease' });
}
