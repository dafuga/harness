import { PNG } from 'pngjs';

/** Real deterministic PNG bytes for disposable native Git/LFS acceptance projects. */
export function nativeImageFixture(): Uint8Array {
	const image = new PNG({ width: 32, height: 24 });
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			const offset = (y * image.width + x) * 4;
			const gold = x > 5 && x < 26 && y > 5 && y < 18;
			image.data.set(gold ? [255, 213, 64, 255] : [3, 28, 41, 255], offset);
		}
	}
	return new Uint8Array(PNG.sync.write(image));
}
