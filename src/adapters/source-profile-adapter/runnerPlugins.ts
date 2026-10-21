import type { sourceProfilePlugin } from './runnerConfig';

/** Shared adoption boundary; normal configuration tests decide when runners are accepted. */
export function sourceProfilePlugins(_root: string): ReturnType<typeof sourceProfilePlugin>[] {
	return [];
}
