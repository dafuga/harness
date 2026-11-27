// @harness-uid u_rned43uh4z
import type { ContainerBrowserRunInput } from '../../workflows/execution-runtimes/runContainerBrowser.types';

export type ContainerBrowserCommandOptions = Omit<
	ContainerBrowserRunInput,
	'action' | 'value' | 'signal'
>;
