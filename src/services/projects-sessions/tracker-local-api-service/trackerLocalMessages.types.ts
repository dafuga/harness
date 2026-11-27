// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

export interface MessageDependencies {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	options: TrackerLocalApiOptions;
	actor: string | null;
}

export type RequestTarget =
	| { kind: 'cos' }
	| { kind: 'run'; item: string; node: string; run: number };
