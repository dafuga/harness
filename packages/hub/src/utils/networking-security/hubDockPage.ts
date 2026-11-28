// @harness-uid u_walhhjgm4k
/** The public site and the one-step handoff pages carry no dock. */
const without = ['/(public-site)', '/native', '/invite'];

/** @pure Whether a signed-in page, named by its route id, shows the agents dock. */
export function hubDockPage(routeId: string | null): boolean {
	return routeId !== null && !without.some((prefix) => routeId.startsWith(prefix));
}
