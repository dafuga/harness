// @harness-uid u_5euoqnzpyw
import type { ContainerCdpAdapter } from '../../adapters/execution-runtimes/ContainerCdpAdapter';

export interface XFeedReaderPorts {
	browser: Pick<ContainerCdpAdapter, 'pages' | 'attach'>;
	pause?: (ms: number) => Promise<void>;
}
