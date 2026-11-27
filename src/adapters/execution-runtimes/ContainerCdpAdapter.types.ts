// @harness-uid u_qqfbrdf4z2
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';

export interface ContainerPageTarget {
	id: string;
	url: string;
}

export type ContainerHistoryAction = 'back' | 'forward' | 'reload';

/** One tab, reached over DevTools. */
export interface ContainerPage {
	evaluate(expression: string): Promise<UntrustedValue>;
	navigate(url: string): Promise<void>;
	close(): void;
}
