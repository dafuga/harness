import { type HelperConsumer } from "./helperConsumers";
import type { ExportedSymbol } from "../core/sourceTypes";
import { type UnitDocumentation } from "./unit-documentation/unitDocumentation";

export interface PublicHelper extends Pick<ExportedSymbol, 'name' | 'inputs' | 'output'> {
	source: string;
	consumers?: HelperConsumer[];
}

export interface UnitMetadata {
	documentation?: UnitDocumentation;
	helpers?: PublicHelper[];
	helperGap?: string;
}

export { unitMetadata } from '../services/revision-detail-service/unitMetadata';
