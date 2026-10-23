import type { hostedData } from './hosted-data';

export type HostedData = ReturnType<typeof hostedData>;

export type HostedProject = HostedData['projects'][number];
