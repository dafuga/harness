export type Provider = 'codex' | 'claude';
export type ProviderConfigOptions = { home: string; codexHome?: string; claudeConfigDir?: string };
export type ProviderPaths = { readPaths: string[]; exactReadDirectories: string[] };
export type ProviderConfigApi = { paths(provider: Provider): Promise<ProviderPaths> };
