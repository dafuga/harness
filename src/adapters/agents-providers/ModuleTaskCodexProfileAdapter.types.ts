export interface ModuleTaskCodexProfileAdapterConfig {
	name?: string;
	resolveExecutable?: (command: string) => string | Promise<string>;
	platform?: NodeJS.Platform;
}
