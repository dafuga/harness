import type { SourceGraphService } from '../../src/services/development-tooling/SourceGraphService';

export type Build = SourceGraphService['build'];

export type Index = Parameters<Build>[0];

export type Manifests = Parameters<Build>[1];

export type Scenarios = NonNullable<Parameters<Build>[2]>;
