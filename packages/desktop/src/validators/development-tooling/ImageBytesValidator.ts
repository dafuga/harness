// @harness-uid u_x6slskmk4r
import { InvalidImageBytesError } from './ImageBytesValidator.types';
import { planImageCodec } from '../../../../planning/src/lib/planning/index';
export class ImageBytesValidator {
	validate(value: Uint8Array): Uint8Array {
		if (!(value instanceof Uint8Array))
			throw new InvalidImageBytesError('Image generator did not return image bytes.');
		planImageCodec(value);
		return value;
	}
}
