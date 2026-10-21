export interface SourceProfileAdapterConfig {
	name?: string;
}

export class SourceProfileAdapter {
	constructor(private readonly config: SourceProfileAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'source-profile';
	}
}
