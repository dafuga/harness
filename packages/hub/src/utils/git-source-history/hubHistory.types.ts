// @harness-uid u_zqt7glcuak
import type { HistoryEvent } from '../../../../desktop/src/models/Desktop.types';

export interface HubHistoryPage {
	entries: HistoryEvent[];
	complete: boolean;
	nextPage: number | null;
}
