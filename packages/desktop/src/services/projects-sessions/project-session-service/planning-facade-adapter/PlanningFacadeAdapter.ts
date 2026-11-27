// @harness-uid u_e5xutuq3ap
import { createPlanning } from '../../../../../../planning/src/lib/planning/index';
import type { ComponentManifest } from '../../../../../../../src/lib/contracts';
import type { PlanningApi } from '../../../../../../planning/src/lib/planning/index';
import type {
	PlanningPort,
	DesignDraft,
	MessageDraft,
	PlanImagesQuery,
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
import type { PlanRecord } from '../../../../models/planning-collaboration/PlanningPort.types';
import type { DesignVersion } from '../../../../models/planning-collaboration/DesignVersion.types';
import type {
	ThreadInfo,
	ThreadMessage,
	ApprovalInfo
} from '../../../../models/development-tooling/Desktop.types';

export class PlanningFacadeAdapter implements PlanningPort {
	private constructor(private context: { root: string; api: PlanningApi }) {}
	static async open(root: string) {
		return new PlanningFacadeAdapter({ root, api: await createPlanning(root) });
	}
	plans(revision: string): Promise<PlanRecord[]> {
		return planningReads(this.context, revision);
	}
	createPlan(draft: PlanDraft): Promise<PlanRecord> {
		return planningWrites(this.context, draft);
	}
	ensurePlan(unit: ComponentManifest): Promise<PlanRecord> {
		return ensurePlan(this.context, unit);
	}
	addDesign(draft: DesignDraft): Promise<DesignVersion> {
		return addPlanDesign(this.context, draft);
	}
	openThread(draft: ThreadDraft): Promise<ThreadInfo> {
		return openPlanThread(this.context, draft);
	}
	messages(entityId: string, threadId: string, revision: string): Promise<ThreadMessage[]> {
		return readPlanMessages(this.context, { entityId, threadId, revision });
	}
	appendMessage(draft: MessageDraft): Promise<ThreadMessage> {
		return planningMessage(this.context, draft);
	}
	approve(draft: ApprovalDraft): Promise<ApprovalInfo> {
		return approvePlanDesign(this.context, draft);
	}
	image(query: PlanImageQuery) {
		return readPlanImage(this.context, query);
	}
	async images(query: PlanImagesQuery) {
		const { entityId, ...selection } = query;
		const captures = await this.context.api.readImages({ ...selection, unitId: entityId });
		return captures.map((capture) => capture.bytes);
	}
	history(entityId: string, revision: string) {
		return readPlanHistory(this.context, entityId, revision);
	}
}
