import { createPlanning } from "../../../../planning/src/index";
import type { ComponentManifest } from "../../../../../src/lib/contracts";
import type { PlanningApi } from "../../../../planning/src/index";
import type { PlanningPort, DesignDraft, MessageDraft, PlanImageQuery } from "../../models/PlanningPort.types.ts";
import type { ApprovalDraft, PlanDraft, ThreadDraft } from "../../models/DesktopBridge.types.ts";
import { planningReads, readPlanImage, readPlanMessages, readPlanHistory } from "./planningReads";
import { planningWrites, ensurePlan, addPlanDesign, openPlanThread, approvePlanDesign } from "./planningWrites";
import { planningMessage } from "./planningMessage";

export class PlanningFacadeAdapter implements PlanningPort {
	private constructor(private context: { root: string; api: PlanningApi }) {}
	static async open(root: string) {
		return new PlanningFacadeAdapter({ root, api: await createPlanning(root) });
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
