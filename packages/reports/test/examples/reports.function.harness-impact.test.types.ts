import type {
	harnessImpact,
	comparedSides
} from '../../src/components/explorer-ui/harness-compare/harnessImpact';

export type Revision = NonNullable<Parameters<typeof harnessImpact>[1]>;

export type Unit = Revision['registry']['units'][number];

export type SourceImpact = NonNullable<Revision['sourceImpact']>;

export type Client = Parameters<typeof comparedSides>[0];
