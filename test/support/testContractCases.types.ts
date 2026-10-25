import type { ComponentManifest } from '../../src/core/unitTypes';

export type ContractUnit = ComponentManifest & {
	testing: NonNullable<ComponentManifest['testing']>;
};
