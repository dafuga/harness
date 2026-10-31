import { expect, type Locator } from '../../../../../../test/support/browserTest';

/** Read the captured gutter pixels: a reserved gutter alone can still hide the scrollbar. */
export async function assertScrollbarPaint(tooltip: Locator, gutter: number) {
	const data = (await tooltip.screenshot({ animations: 'disabled' })).toString('base64');
	const painted = await tooltip.evaluate(
		async (node, { data, gutter }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${data}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.width;
			canvas.height = image.height;
			const draw = canvas.getContext('2d')!;
			draw.drawImage(image, 0, 0);
			const pixels = draw.getImageData(
				image.width - gutter,
				20,
				gutter - 2,
				image.height - 40
			).data;
			const color = getComputedStyle(node, '::-webkit-scrollbar-thumb')
				.backgroundColor.match(/\d+/g)!
				.slice(0, 3)
				.map(Number);
			return pixels.some(
				(_, index) =>
					index % 4 === 0 && color.every((value, channel) => pixels[index + channel] === value)
			);
		},
		{ data, gutter }
	);
	expect(painted, 'The overflowing tooltip paints a visible scrollbar thumb').toBe(true);
}
