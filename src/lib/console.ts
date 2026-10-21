/**
 * Server-side contracts of the Harness console: the host policy that every page, data and media
 * request must pass, and the two ways data reaches the handlers. Everything here uses only Web
 * platform APIs, so it runs on Workers as well as on Node and Bun.
 */
export {
	consolePolicy,
	loopbackAddress
} from '../../packages/reports/src/utils/console-server/consolePolicy';
export { denyAll } from '../utils/explorer-ui/consolePolicy';
export type { ConsolePolicy, ConsoleRequest, OwnerMode } from '../utils/explorer-ui/consolePolicy';
export { consoleAccess } from '../../packages/reports/src/utils/console-server/consoleAccess';
export type {
	ConsoleAccess,
	ConsoleData,
	ConsoleExporter,
	ConsoleExportInput,
	ConsoleHost,
	ConsoleSource
} from '../utils/explorer-ui/consoleAccess';
export { consoleStore } from '../utils/development-tooling/consoleStore';
export type { ConsoleBucket, ConsoleObject } from '../utils/development-tooling/consoleStore';
export { buildStamp, sdkPackage } from '../utils/development-tooling/buildStamp';
export { consoleBundle } from '../utils/development-tooling/consoleBundle';
export type { ConsoleModules } from '../utils/development-tooling/consoleBundle';
export { consoleDocument } from '../utils/development-tooling/consoleDocument';
export type {
	ConsoleAssets,
	ConsoleDocumentOptions
} from '../utils/development-tooling/consoleDocument';
export {
	commitBranch,
	consoleCanonical,
	defaultCommit,
	explorerAddress,
	explorerExact,
	explorerHome
} from '../utils/projects-sessions/console-canonical/consoleCanonical';
export { type IndexedHistory } from '../utils/projects-sessions/console-canonical/consoleCanonical';
export { explorerLegacy } from '../utils/projects-sessions/console-canonical/explorerLegacy';
export {
	explorerCategories,
	explorerKindCategory,
	explorerRoute,
	explorerRoutePath,
	explorerSections,
	explorerTabs
} from '../utils/explorer-ui/explorerRoute';
export type {
	ExplorerCategory,
	ExplorerLocation,
	ExplorerSection,
	ExplorerTab
} from '../utils/explorer-ui/explorerRoute';
export { consoleRoute } from '../utils/projects-sessions/console-canonical/consoleRoute';
export { consoleRoutePath } from '../../packages/reports/src/components/project-activity/consoleRoute';
export { consoleViews } from '../utils/projects-sessions/consoleRoute';
export type { ConsoleRoute, ConsoleView } from '../utils/projects-sessions/consoleRoute';
