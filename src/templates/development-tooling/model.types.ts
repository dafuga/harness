import type { Field } from '../../core/development-tooling/fields/fields';

export type AdapterName = 'd1' | 'sqlite' | 'postgres';

export interface ModelInput {
	name: string;
	fields: Field[];
	adapter: AdapterName;
}
