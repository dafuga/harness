import type { SourceIndex } from '../../src/services/source-index-service/SourceIndexService';
import type { UnitIndexResult } from '../../src/services/unit-index-service/UnitIndexService';

export interface Indexed {
	index: SourceIndex;
	result: UnitIndexResult;
}
