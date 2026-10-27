import type {
	TaskRunInput,
	TaskRunResult,
	TaskSelection,
	TaskUsage
} from '../../repositories/agents-providers/ModuleTaskRepository.types';

export interface BrokerFileWrite {
	path: string;
	expectedSha256: string;
	text: string;
}

export interface BrokerTools {
	readContract(unitId: string): Promise<unknown>;
	listContracts(kind?: string): Promise<unknown>;
	readAssigned(path: string): Promise<{ text: string; sha256: string }>;
	writeAssigned(input: BrokerFileWrite): Promise<{ sha256: string }>;
}

export interface BrokerSession {
	tools: BrokerTools;
	close(): Promise<void>;
}

export interface BrokerClientRequest extends TaskSelection {
	cwd: string;
	prompt: string;
	signal: AbortSignal;
	tools: BrokerTools;
}

export interface BrokerClientResult {
	text: string;
	reportedModel?: string | null;
	usage?: TaskUsage;
}

export interface BrokerClient {
	ready(): Promise<void>;
	run(request: BrokerClientRequest): Promise<BrokerClientResult>;
}

export interface ModuleTaskBrokerTransportAdapterConfig {
	client?: Partial<BrokerClient>;
	openBroker?: (input: TaskRunInput) => Promise<BrokerSession>;
}

export type { TaskRunInput, TaskRunResult, TaskSelection, TaskUsage };
