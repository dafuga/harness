export interface AuditFinding {
	path: string;
	rule: string;
	message: string;
}

export interface Block {
	kind: 'class' | 'function' | 'method';
	start: number;
	end: number;
	lines: string[];
}
