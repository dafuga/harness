import type { TrackerReceiptUsage } from '../../../services/agents-providers/TrackerDispatcherService.types';

export interface CodexCounters {
	usage?: TrackerReceiptUsage;
	balance?: string;
}
