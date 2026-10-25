export interface TestArtifact {
	unit: string;
	case: string;
	state: string;
	evidence: string;
	file: string;
	bytes: Uint8Array;
	transcript: string;
	provenance: 'fixture' | 'actual-capture';
}
