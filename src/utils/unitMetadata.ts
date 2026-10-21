import { type HelperConsumer } from './helperConsumers';
import type { ExportedSymbol } from '../core/sourceTypes';
import { type UnitDocumentation } from './unit-documentation/unitDocumentation';

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
	/** Explicit @pure source contract accepted by the conservative effect guard. */
	pure?: boolean;
	consumers?: HelperConsumer[];
}

export interface SourceFileSnapshot {
	path: string;
	/** Content-addressed UTF-8 text under the existing protected history media endpoint. */
	media: string | null;
	gap?: string;
}

export interface UnitMetadata {
	sourceFiles?: SourceFileSnapshot[];
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	helperGap?: string;
}

export { unitMetadata } from '../services/revision-detail-service/unitMetadata';
