import type { serviceContract } from '../../src/components/explorer-ui/entity-contract/serviceMethods';

export type Unit = Parameters<typeof serviceContract>[0];

export type Result = ReturnType<typeof serviceContract>;

export type Fields = Pick<Unit, 'owns' | 'contract'> &
	Partial<Pick<Unit, 'serviceClasses' | 'modelDefinitions'>>;

export type Call = { symbol: string; input: unknown; run: () => unknown };
