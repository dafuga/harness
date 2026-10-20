/**
 * Server-side contracts of the Harness console: the host policy that every page, data and media
 * request must pass, and the two ways data reaches the handlers. Everything here uses only Web
 * platform APIs, so it runs on Workers as well as on Node and Bun.
 */
export {
	consolePolicy,
	loopbackAddress
} from '../../packages/reports/src/utils/console-server/consolePolicy';
export { denyAll } from '../utils/consolePolicy';
export type { ConsolePolicy, ConsoleRequest, OwnerMode } from '../utils/consolePolicy';
export { consoleAccess } from '../../packages/reports/src/utils/console-server/consoleAccess';
export type {
	ConsoleAccess,
	ConsoleData,
	ConsoleExporter,
	ConsoleExportInput,
	ConsoleHost,
	ConsoleSource
} from '../utils/consoleAccess';
export { consoleStore } from '../utils/consoleStore';
export type { ConsoleBucket, ConsoleObject } from '../utils/consoleStore';
export { buildStamp, sdkPackage } from '../utils/buildStamp';
export { consoleBundle } from '../utils/consoleBundle';
export type { ConsoleModules } from '../utils/consoleBundle';
export { consoleDocument } from '../utils/consoleDocument';
export type { ConsoleAssets, ConsoleDocumentOptions } from '../utils/consoleDocument';
export {
	commitBranch,
	consoleCanonical,
	defaultCommit,
	explorerAddress,
	explorerExact,
	explorerHome
} from '../utils/console-canonical/consoleCanonical';
export { type IndexedHistory } from '../utils/console-canonical/consoleCanonical';
export { explorerLegacy } from '../utils/console-canonical/explorerLegacy';
export {
	explorerCategories,
	explorerKindCategory,
	explorerRoute,
	explorerRoutePath,
	explorerSections,
	explorerTabs
} from '../utils/explorerRoute';
export type {
	ExplorerCategory,
	ExplorerLocation,
	ExplorerSection,
	ExplorerTab
} from '../utils/explorerRoute';
export { consoleRoute } from '../utils/console-canonical/consoleRoute';
export { consoleRoutePath } from '../../packages/reports/src/components/project-activity/consoleRoute';
export { consoleViews } from '../utils/consoleRoute';
export type { ConsoleRoute, ConsoleView } from '../utils/consoleRoute';
