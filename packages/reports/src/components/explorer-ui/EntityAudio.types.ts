import type { ComparisonPane } from '../../helpers/verification-evidence/comparisonPanes.types';
import type { Evidence } from '../../models/reports-media/Report.types';

export interface Pair {
	key: string | undefined;
	panes: ComparisonPane<Evidence>[];
}
