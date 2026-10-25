export interface ModuleDataSnapshotValidatorResult {
	valid: boolean;
	errors: string[];
}

export interface ModuleSourceProducerInput {
	producer: string;
	declarations: Array<{ owns: { source: string[] } }>;
}
