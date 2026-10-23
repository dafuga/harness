import type { HubSourceContext } from '../../../../utils/development-tooling/hubSource';

export interface Context {
	base: HubSourceContext;
	within: string | null;
	reaches: (tip: string, commit: string) => Promise<boolean>;
}
