import type { GET } from '../../src/routes/harness/media/[file]/+server';

export type Event = Parameters<typeof GET>[0];
