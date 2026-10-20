import { type HelperConsumer } from './helperConsumers';
import type { ExportedSymbol } from '../core/sourceTypes';
import type { z } from 'zod';
import type { usageExampleSchema } from '../core/unitTypes';
import { type UnitDocumentation } from './unit-documentation/unitDocumentation';

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
	examples?: z.infer<typeof usageExampleSchema>[];
	/** Explicit @pure source contract accepted by the conservative effect guard. */
	pure?: boolean;
	consumers?: HelperConsumer[];
}

export interface UnitMetadata {
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	helperGap?: string;
}

export { unitMetadata } from '../services/revision-detail-service/unitMetadata';
