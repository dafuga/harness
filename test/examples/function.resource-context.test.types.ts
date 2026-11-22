import type { resourceContext } from '../../src/utils/execution-runtimes/resourceContext';

export type Queue = Parameters<typeof resourceContext>[3];

export type Request = Parameters<typeof resourceContext>[1];
