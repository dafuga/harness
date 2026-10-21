import type { HarnessRevision } from '../src/models/Harness.types';
import { revision } from './entityFixture';
import { commits, ids } from './entityUnits';
import { withHelpers } from './entityPreviewHelpers';
import { withFrame, withGroups } from './entityPreviewData';

/** Distinct text makes incorrect commit, selected file and HTML execution observable. */
export function sourceText(commit: string, path: string): string {
	return `// Synthetic committed file: ${path}\nexport const sourceRevision = '${commit}';\n// <script>throw new Error('Source must remain text')</script>\n`;
}

/** All seven kinds retain supported aliases beside category implementations. */
export function sourceCatalog(detail: HarnessRevision): HarnessRevision {
	const added = withGroups(withHelpers(withFrame(detail, 'shell')));
	return {
		...added,
		registry: {
			...added.registry,
			units: added.registry.units.map((unit) =>
				unit.id === ids.store
					? {
							...unit,
							owns: {
								...unit.owns,
								source: [...unit.owns.source, 'src/services/orders/Order types #é.ts']
							}
						}
					: unit
			)
		}
	};
}

export const sourcePaths = [
	...new Set(
		sourceCatalog(revision(commits.tip, [])).registry.units.flatMap((unit) => unit.owns.source)
	)
];

/** The same content-addressed snapshots are served through the normal preview fixture. */
export function sourceSnapshots(detail: HarnessRevision, hashes: Record<string, string>) {
	return {
		...detail,
		registry: {
			...detail.registry,
			units: detail.registry.units.map((unit) => ({
				...unit,
				...{
					sourceFiles: unit.owns.source.map((path) => ({
						path,
						media: `media/${hashes[`source:${detail.commit}:${path}`]}.txt`
					}))
				}
			}))
		}
	};
}
