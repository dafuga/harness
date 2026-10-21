import { type HelperConsumer } from './helperConsumers';
import type { ExportedSymbol } from '../core/sourceTypes';
import { type UnitDocumentation } from './unit-documentation/unitDocumentation';

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
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
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	/** Runtime exports and their distinct owning code units at this exact revision. */
	serviceExports?: Array<{ source: string; name: string }>;
	serviceConsumers?: HelperConsumer[];
	/** Concrete declarations, instance methods and constructor references from this revision. */
	serviceClasses?: PublicServiceClass[];
	helperGap?: string;
}

export { unitMetadata } from '../services/revision-detail-service/unitMetadata';
