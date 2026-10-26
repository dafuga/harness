export interface ModuleTaskProviderConfigAdapterConfig {
	name?: string;
	home?: string;
	codexHome?: string;
	claudeConfigDir?: string;
}

export interface ModuleTaskProviderConfigPaths {
	readPaths: string[];
	exactReadDirectories: string[];
}
