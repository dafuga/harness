// @harness-uid u_ttl26nd5p5
import type { Measure } from '../../models/development-tooling/Desktop.types';

/** One panel row: its name, and the measure whose text and availability it shows. */
export interface MeasuresPanelRow {
	name: string;
	measure: Measure;
}
