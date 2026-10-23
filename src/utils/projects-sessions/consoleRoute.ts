export const consoleViews = ['map', 'compare', 'history', 'growth', 'activity'] as const;

export { consoleRoute } from './console-canonical/consoleRoute';
export { consoleRoutePath } from '../../../packages/reports/src/components/project-activity/consoleRoute';

export type { ConsoleView, ConsoleRoute } from './consoleRoute.types';
