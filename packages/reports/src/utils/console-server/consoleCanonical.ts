import { IndexedHistory, explorerAddress } from '../../../../../src/utils/console-canonical/consoleCanonical';


/**
 * Where a console address that is not an explorer address leads, under the route the console is
 * served at. Undefined when the address is exact already, or the index holds no commit.
 */
export function consoleCanonical(
	index: IndexedHistory,
	url: URL,
	base: string
): string | undefined {
	const address = explorerAddress(index, url.pathname.slice(base.length), url.search);
	return address === undefined ? undefined : `${base}${address}`;
}
