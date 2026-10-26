import { lfsAttributes, lfsPointer, lfsStored } from '../../src/utils/lfsPointer';
import { parseLfsPointer } from '../../src/services/attached-record-service/lfsPointer';
import type { ExampleFunctions } from '../../src/services/verification-evidence/TestExpectationService.types';
import type { LfsObject } from '../../src/utils/verification-evidence/lfsPointer.types';
import type { LfsFixtureMarker } from './lfsPointerExamples.types';

/** JSON cannot carry these values, so each authored marker names the value its call rebuilds. */
function reconstructArgument(argument: unknown): unknown {
	if (typeof argument !== 'object' || argument === null || !Object.hasOwn(argument, '$fixture'))
		return argument;
	const marker = argument as LfsFixtureMarker;
	switch (marker.$fixture) {
		case 'undefined':
			return undefined;
		case 'symbol':
			return Symbol(marker.description);
		case 'getter-object':
			return getterObject(marker.file as LfsObject);
		case 'lfs-pointer':
			return lfsPointer(marker.file as LfsObject);
		default:
			throw new Error(`Unknown authored fixture ${marker.$fixture}`);
	}
}

/** Exposes each field through an accessor, as a value object built with getters would. */
function getterObject({ sha256, bytes }: LfsObject): LfsObject {
	return {
		get sha256() {
			return sha256;
		},
		get bytes() {
			return bytes;
		}
	};
}

/** Each callable is reached through the public entry that the original assertions imported. */
export const lfsPointerExampleFunctions: ExampleFunctions = {
	lfsPointer: (...input: never[]) => lfsPointer(reconstructArgument(input[0]) as LfsObject),
	parseLfsPointer: (...input: never[]) => parseLfsPointer(reconstructArgument(input[0]) as string),
	lfsStored: (...input: never[]) => lfsStored(reconstructArgument(input[0]) as string),
	lfsAttributes
};
