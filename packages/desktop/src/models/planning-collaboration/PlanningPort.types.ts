import type {
	ApprovalInfo,
	Category,
	DesignVersion,
	EntityContract,
	HistoryEvent,
	Region,
	ThreadInfo,
	ThreadMessage
} from '../development-tooling/Desktop.types';
import type {
	ApprovalDraft,
	PlanDraft,
	ThreadDraft
} from '../development-tooling/DesktopBridge.types';
import type { HostFileChange } from '../../../../planning/src/lib/planning/index';

/** A draft plan as the planning package keeps it, in the words the desktop shows. */
export interface PlanRecord {
	id: string;
	path: string;
	category: Category;
	title: string;
	goal: string;
	lifecycle: string;
	contract: EntityContract;
	versions: DesignVersion[];
	threads: ThreadInfo[];
}

export interface DesignDraft {
	entityId: string;
	prompt: string;
	generator: { provider: 'codex' | 'claude'; model: string };
	baseRevision: string;
	expectedLatest?: string | null;
	state: string;
	viewport: string;
	bytes: Uint8Array | null;
	notes?: string;
	revises?: {
		version: string;
		imageSha256: string;
		region: Region | null;
		threadId: string | null;
		/** The design option holding that image, when its version has options. */
		option?: string;
	};
	/** Separately generated alternatives saved together; `bytes` is then null. */
	options?: DesignOptionDraft[];
}

export interface DesignOptionDraft {
	direction: string;
	bytes: Uint8Array;
	/** The exact prompt the image was generated from, and the one the generator reports. */
	prompt: string;
	revisedPrompt: string | null;
}

export interface MessageDraft extends Omit<ThreadMessage, 'id' | 'at'> {
	entityId: string;
	threadId: string;
	change?: {
		status: 'requested' | 'running' | 'completed' | 'failed' | 'cancelled';
		paths?: string[];
		hostChanges?: HostFileChange[];
		error?: string | null;
	};
}

export interface PlanImageQuery {
	entityId: string;
	version: string;
	sha256: string;
	revision: string;
	/** When given, the image must belong to this design option. */
	option?: string;
}

/**
 * What the desktop needs from the planning package of one repository. The planning facade
 * is adapted to this port, so nothing else here depends on that package's own types.
 */
export interface PlanningPort {
	plans(revision: string): Promise<PlanRecord[]>;
	createPlan(draft: PlanDraft): Promise<PlanRecord>;
	addDesign(draft: DesignDraft): Promise<DesignVersion>;
	openThread(draft: ThreadDraft): Promise<ThreadInfo>;
	messages(entityId: string, threadId: string, revision: string): Promise<ThreadMessage[]>;
	appendMessage(draft: MessageDraft): Promise<ThreadMessage>;
	approve(draft: ApprovalDraft): Promise<ApprovalInfo>;
	image(query: PlanImageQuery): Promise<Uint8Array>;
	history(entityId: string, revision: string): Promise<HistoryEvent[]>;
}
