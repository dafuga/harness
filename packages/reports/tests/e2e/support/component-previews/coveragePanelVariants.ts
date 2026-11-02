/** Evidence that is still read, failed, unavailable or never recorded: no result is shown in any of them. */
const absent: Record<string, { status: string; error: string }> = {
	loading: { status: 'loading', error: '' },
	failed: { status: 'failed', error: 'The evidence store did not answer the request.' },
	unavailable: { status: 'unavailable', error: '' },
	planned: { status: 'planned', error: '' }
};
export function coveragePanelVariantProps<
	T extends { entity?: unknown; evidence?: unknown; workspace?: unknown }
>(props: T, variant: string) {
	// Optional workspace: without it the regression proof section is not offered at all.
	if (variant === 'without-workspace') return { ...props, workspace: undefined };
	const state = absent[variant];
	if (!state) return props;
	// The panel shows a component, so a planned component is named as one.
	if (variant === 'planned')
		return {
			...props,
			entity: { ...(props.entity as object), kind: 'component' },
			evidence: { ...state, result: null, url: () => '' }
		};
	return { ...props, evidence: { ...state, result: null, url: () => '' } };
}
