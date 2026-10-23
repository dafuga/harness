export interface Execution {
	status: string;
	results: { attachments: { name: string; body: string }[]; errors: unknown[] }[];
}

export interface Spec {
	tests: Execution[];
}
