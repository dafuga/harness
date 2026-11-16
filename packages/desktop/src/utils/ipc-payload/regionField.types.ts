// @harness-uid u_gnssflbak6
/** An image region with a coordinate outside 0 to 1, no area, or an edge past the image. */
export class ImageRegionError extends Error {
	override name = 'ImageRegionError';
}
