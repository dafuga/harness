import { type HelperConsumer } from './helperConsumers';
import type { ExportedSymbol } from '../../core/development-tooling/sourceTypes';
import type { z } from 'zod';
import type { usageExampleSchema } from '../../core/development-tooling/unitTypes';
import { type UnitDocumentation } from './unit-documentation/unitDocumentation';

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
	examples?: z.infer<typeof usageExampleSchema>[];
	/** Explicit @pure source contract accepted by the conservative effect guard. */
	pure?: boolean;
	consumers?: HelperConsumer[];
}

export interface PublicServiceClass {
	source: string;
	name: string;
	methods: string[];
	constructedBy: HelperConsumer[];
	consumers: HelperConsumer[];
}

export interface UnitMetadata {
	group?: { id: string; title: string };
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	/** Runtime exports and their distinct owning code units at this exact revision. */
	serviceExports?: Array<{ source: string; name: string }>;
	serviceConsumers?: HelperConsumer[];
	/** Concrete declarations, instance methods and constructor references from this revision. */
	serviceClasses?: PublicServiceClass[];
	helperGap?: string;
}

export { unitMetadata } from '../../services/explorer-ui/revision-detail-service/unitMetadata';
