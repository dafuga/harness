import type { HarnessRevision } from '../src/models/Harness.types';
import { expect } from 'vitest';
import { focusedCaptures } from '../src/utils/explorer-ui/explorer-evidence/focusedCaptures';
import { withFocused } from './entityStates';
import { ids } from './entityUnits';

/** Exercise the public in-memory entry before serialization can erase these properties. */
export function expectFocusedImageAdmission(tip: HarnessRevision): void {
	const detail = withFocused(tip, ids.page);
	const points = detail.regressions!;
	Object.defineProperty(points, Symbol.iterator, { value: Array.prototype.values });
	Object.defineProperty(points, 'constructor', { value: { [Symbol.species]: Array } });
	const capture = points[0].green!.captures![0].capture;
	const kind = capture.kind;
	let reads = 0;
	Object.defineProperty(capture, 'kind', {
		enumerable: true,
		get: () => {
			reads++;
			return kind;
		}
	});
	const selected = focusedCaptures(detail, ids.page);
	expect(selected.map((item) => item.state)).toEqual(['default', 'default', 'default']);
	expect(reads).toBeGreaterThan(0);
	expect(Object.getOwnPropertyDescriptor(capture, 'kind')?.get).toBeDefined();
}
