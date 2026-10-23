export interface AssertionInput {
	report: unknown;
	observations: string;
	invocation: string;
	cwd: string;
	status: number | null;
}
