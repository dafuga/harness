// @harness-uid u_jv6fst3qm3
import type { ConsoleRequest } from './consolePolicy';

/** Where console data comes from: a directory, or modules bundled into the server. */
export interface ConsoleData {
	/** JSON text of `index.json`, `activity.json` or `revisions/<commit>.json`; undefined when absent. */
	json(path: string): Promise<string | undefined>;
	/** Original bytes of one media file named `<sha256>.<extension>`. */
	media(name: string): Promise<{ bytes: Uint8Array; type: string } | undefined>;
}

/** Data that is the same for every request, or a store opened from the admitted request. */
export type ConsoleSource = ConsoleData | ((event: ConsoleRequest) => ConsoleData);

/** What the host says about itself, reported beside the build and the package that answered. */
export interface ConsoleHost {
	/** Revision of the host application this console was built into. */
	revision?: string;
	/** The stamp slot of the host's emitted code, as `harness verify stamp` left it. */
	build?: string;
}

export interface ConsoleAccess {
	/** A 403 response when the policy does not admit the request; undefined when it does. */
	guard(event: ConsoleRequest): Promise<Response | undefined>;
	/**
	 * What must be answered before the console document: a refusal, or a redirect from the root
	 * or an earlier query address to the page path it stands for. Undefined for a page path.
	 */
	entry(event: ConsoleRequest, base: string): Promise<Response | undefined>;
	/** One stored JSON file, or `build.json`: the build, package and host that answered. */
	json(event: ConsoleRequest, path: string): Promise<Response>;
	media(event: ConsoleRequest, name: string): Promise<Response>;
}

export { consoleAccess } from '../../../packages/reports/src/utils/explorer-ui/console-server/consoleAccess';
