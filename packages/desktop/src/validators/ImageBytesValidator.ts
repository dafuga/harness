import { planImageCodec } from '../../../planning/src/lib/planning/index';
export class ImageBytesValidator {
	validate(value: Uint8Array): Uint8Array {
		if (!(value instanceof Uint8Array))
			throw new Error('Image generator did not return image bytes.');
		planImageCodec(value);
		return value;
	}
}
