import type { historyPages } from '../../src/components/git-source-history/history-panel/historyPages';

export type HistoryEvent = Parameters<typeof historyPages>[number][number];
