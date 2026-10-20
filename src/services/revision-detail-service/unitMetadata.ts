import { pureHelpers } from './pureHelpers';
import { helperConsumers } from './helperConsumers';
import { type HelperTree } from '../../utils/helperConsumers';
import { createHash } from 'node:crypto';
import type { ExportedSymbol, SourceTree } from '../../core/sourceTypes';
import type { RevisionRegistry } from '../../utils/revision-registry/revisionRegistry';
import { scanExports } from '../../utils/scanExports';
import { hydrateUnitDocumentation } from './unitDocumentation';

type Unit = RevisionRegistry['units'][number];

const kinds = new Set(['function', 'helper', 'shared-function', 'module']);

const shared =
	/(?:^|\/)src\/(?:utils|helpers|functions|core|lib\/(?:utils|helpers|functions))\/.+\.(?:[cm]?[jt]s|[jt]sx)$/;

// Keys hash bytes actually read, never an unchecked revision-looking string.
const scanned = new Map<string, Array<ExportedSymbol & { pure: boolean }>>();

function exportsOf(text: string): Array<ExportedSymbol & { pure: boolean }> {
	const key = createHash('sha256').update(text).digest('hex');
	const held = scanned.get(key);
	if (held) return held;
	const pure = pureHelpers(text);
	const exports = scanExports(text)
		.symbols.filter((symbol) => symbol.kind === 'function')
		.map((symbol) => ({ ...symbol, pure: pure.has(symbol.name) }));
	if (scanned.size >= 4096) scanned.delete(scanned.keys().next().value!);
	scanned.set(key, exports);
	return exports;
}

/** Read export signatures from utility locations before counting their actual consumers. */
async function helpersAt(tree: Pick<SourceTree, 'read'>, path: string) {
	try {
		return {
			helpers: exportsOf(await tree.read(path)).map((symbol) => ({ ...symbol, source: path }))
		};
	} catch {
		return { helpers: [], gap: `Shared helpers could not be read from ${path} at this commit.` };
	}
}

/** Enrich the selected revision from its own source; absent historical files stay absent. */
export async function unitMetadata(tree: HelperTree, units: Unit[]): Promise<void> {
	await hydrateUnitDocumentation(tree, units);
	const paths = [
		...new Set(
			units
				.filter((unit) => kinds.has(unit.kind))
				.flatMap((unit) => unit.owns.source.filter((path) => shared.test(path)))
		)
	];
	const found = new Map<string, Awaited<ReturnType<typeof helpersAt>>>();
	for (let start = 0; start < paths.length; start += 64) {
		await Promise.all(
			paths.slice(start, start + 64).map(async (path) => {
				found.set(path, await helpersAt(tree, path));
			})
		);
	}
	for (const unit of units) {
		const files = kinds.has(unit.kind) ? unit.owns.source.map((path) => found.get(path)) : [];
		const documented = new Map(
			unit.helpers?.map((helper) => [`${helper.source}#${helper.name}`, helper.examples])
		);
		unit.helpers = files
			.flatMap((file) => file?.helpers ?? [])
			.map((helper) => {
				const examples = documented.get(`${helper.source}#${helper.name}`);
				return { ...helper, ...(examples ? { examples } : {}) };
			});
		const gaps = files.flatMap((file) => (file?.gap ? [file.gap] : []));
		if (gaps.length) unit.helperGap = gaps.join(' ');
		else delete unit.helperGap;
	}
	await helperConsumers(tree, units);
}
