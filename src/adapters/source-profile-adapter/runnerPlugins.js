/** Native entry; the existing typed loader remains behind this boundary until adoption proof. */
export default async function nativeProfilePlugins(root) {
	const implementation = await import(new URL('./runnerPlugins.ts', import.meta.url).href);
	return implementation.sourceProfilePlugins(root);
}
