// @harness-uid u_bl6xl2h4a3
import type { TrackerSchemaAdapter } from '../../../adapters/projects-sessions/TrackerSchemaAdapter';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';

export interface GuestCommandContext {
	items: TrackerItemReadRepository;
	schema: TrackerSchemaAdapter;
	now: number;
	timeZone?: string;
}

export interface GuestCommandReceipt {
	commands: string[];
	completed: boolean;
}
