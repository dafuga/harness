import type { EmailProofDelivery } from '../../src/models/HubAuth.types';
import type { EmailProofMessage } from '../../src/models/HubAuth.types';
import type { hubFixture } from './hubFixture';

export interface HubOptions {
	github?: boolean;
	delivery?: boolean;
}

export interface FakeDelivery extends EmailProofDelivery {
	sent: EmailProofMessage[];
	failing: boolean;
}

export type HubFixture = Awaited<ReturnType<typeof hubFixture>>;
