export interface EntryRun {
	argv: string[];
	stdout: string[];
	stderr: string[];
	exitCode: number | undefined;
}
