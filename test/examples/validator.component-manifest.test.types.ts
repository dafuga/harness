import type { ComponentManifestValidator } from '../../src/validators/development-tooling/ComponentManifestValidator';

export type Manifest = NonNullable<ReturnType<ComponentManifestValidator['validate']>['value']>;

export type Result = ReturnType<ComponentManifestValidator['validate']>;
