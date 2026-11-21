import type { Readable } from 'node:stream';
import type { TrackerSpokeRequest } from '../../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import type { createSpokeJournal } from './trackerSpokeFixture';

export type FixtureJournal = ReturnType<typeof createSpokeJournal>;
export type LegacyHandlerFactory = (options: {
	store: Pick<FixtureJournal, 'node' | 'applyOps' | 'opsSince' | 'maxSeq'> & {
		dbId: string;
		on: () => void;
	};
	secret: string;
}) => (
	request: Readable & { method: string; url: string; headers: TrackerSpokeRequest['headers'] },
	response: { writeHead: (status: number) => void; end: (body: string) => void }
) => Promise<void>;
