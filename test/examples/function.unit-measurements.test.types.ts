import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Targets = ComponentManifest['runtime']['targets'];

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
