import { createPlanning } from '../../../../../../planning/src/lib/planning/index';
import { ModuleDataService } from '../../../../../../../src/services/git-source-history/ModuleDataService';
import type { ComponentManifest } from '../../../../../../../src/lib/contracts';
import type { PlanningApi } from '../../../../../../planning/src/lib/planning/index';
import type {
	PlanningPort,
	DesignDraft,
	MessageDraft,
	PlanImageQuery
} from '../../../../models/planning-collaboration/PlanningPort.types';
import type {
	ApprovalDraft,
	PlanDraft,
	ThreadDraft
} from '../../../../models/development-tooling/DesktopBridge.types';
import { planningReads, readPlanImage, readPlanMessages, readPlanHistory } from './planningReads';
import {
	planningWrites,
	ensurePlan,
	addPlanDesign,
	openPlanThread,
	approvePlanDesign
} from './planningWrites';
import { planningMessage } from './planningMessage';

export class PlanningFacadeAdapter implements PlanningPort {
	private constructor(private context: { root: string; api: PlanningApi }) {}
	static async open(root: string) {
		return new PlanningFacadeAdapter({
			root,
			api: committedPlanningApi(root, await createPlanning(root))
		});
	}
	plans(revision: string) {
		return planningReads(this.context, revision);
	}
	createPlan(draft: PlanDraft) {
		return planningWrites(this.context, draft);
	}
	ensurePlan(unit: ComponentManifest) {
		return ensurePlan(this.context, unit);
	}
	addDesign(draft: DesignDraft) {
		return addPlanDesign(this.context, draft);
	}
	openThread(draft: ThreadDraft) {
		return openPlanThread(this.context, draft);
	}
	messages(entityId: string, threadId: string, revision: string) {
		return readPlanMessages(this.context, { entityId, threadId, revision });
	}
	appendMessage(draft: MessageDraft) {
		return planningMessage(this.context, draft);
	}
	approve(draft: ApprovalDraft) {
		return approvePlanDesign(this.context, draft);
	}
	image(query: PlanImageQuery) {
		return readPlanImage(this.context, query);
	}
	history(entityId: string, revision: string) {
		return readPlanHistory(this.context, entityId, revision);
	}
}

/** The app is a source writer too: publish complete metadata for each exact planning commit. */
function committedPlanningApi(root: string, api: PlanningApi): PlanningApi {
	const metadata = new ModuleDataService(root);
	const committed = async <Result extends { commit: string }>(work: Promise<Result>) => {
		const result = await work;
		await metadata.validate({ commit: result.commit, write: true });
		await metadata.require(result.commit);
		return result;
	};
	return {
		...api,
		createPlan: (input) => committed(api.createPlan(input)),
		addDesign: (input) => committed(api.addDesign(input)),
		openThread: (input) => committed(api.openThread(input)),
		appendMessage: (input) => committed(api.appendMessage(input)),
		approveDesign: (input) => committed(api.approveDesign(input))
	};
}
