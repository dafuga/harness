import type { artifactBytes } from '../../src/components/shared-primitives/recorded-preview/artifactBytes';

export type Bridge = Parameters<typeof artifactBytes>[0];

export type Query = Parameters<typeof artifactBytes>[1];
