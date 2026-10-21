import type { HarnessRevision } from '../src/models/Harness.types';
import { units } from './entityUnits';
import { withHelpers } from './entityPreviewHelpers';
import { withFrame } from './entityPreviewData';

/** Distinct text per file and commit makes wrong-revision and stale-file reads observable. */
export function sourceText(commit: string, path: string): string {
	return `// Synthetic committed file: ${path}\nexport const sourceRevision = '${commit}';\n// <script>throw new Error('Source must remain text')</script>\n`;
}

export const sourcePaths = [
	...new Set(units.flatMap((unit) => unit.owns.source)),
	'src/models/Order.ts',
	'src/shells/OrderFrame.svelte',
	'src/services/Order types #é.ts'
];

/** The standard catalog matrix gains all seven kinds and a second owned service file. */
export function sourceCatalog(detail: HarnessRevision): HarnessRevision {
	const added = withHelpers(withFrame(detail, 'shell'));
	return {
		...added,
		registry: {
			...added.registry,
			units: added.registry.units.map((unit) =>
				unit.kind === 'service'
					? { ...unit, owns: { ...unit.owns, source: ['src/services/'] } }
					: unit
			)
		}
	};
}

export function sourceSnapshots(detail: HarnessRevision, hashes: Record<string, string>) {
	return {
		...detail,
		registry: {
			...detail.registry,
			units: detail.registry.units.map((unit) => ({
				...unit,
				sourceFiles: (unit.kind === 'service'
					? sourcePaths.filter((path) => path.startsWith('src/services/'))
					: unit.owns.source
				).map((path) => ({
					path,
					media: `media/${hashes[`source:${detail.commit}:${path}`]}.txt`
				}))
			}))
		}
	};
}
