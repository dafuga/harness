import type { PreviewCases } from './shared';
import * as d from './explorerData';
export const shellNavProps: Record<
	string,
	(props: PreviewCases[string], variant: string) => PreviewCases[string]
> = {
	'reports.component.harness-harness-header': harnessHarnessHeaderProps,
	'reports.component.harness-harness-navbar': harnessHarnessNavbarProps,
	'reports.component.harness-harness-selectors': harnessHarnessSelectorsProps,
	'reports.component.harness-harness-console': harnessHarnessConsoleProps
};

function harnessHarnessHeaderProps(props: PreviewCases[string], variant: string) {
	if (variant === 'problem')
		return { ...props, problem: 'The selected history could not be loaded.' };
	if (variant.startsWith('missing'))
		return {
			...props,
			missing: {
				message: 'This revision is not present in the retained history.',
				home: variant === 'missing-no-home' ? null : '/branch/main/components'
			}
		};
	return {
		...props,
		navbar: {
			...(props.navbar as object),
			repository:
				'Orders workspace with a deliberately long repository name for responsive navigation'
		}
	};
}

function harnessHarnessNavbarProps(props: PreviewCases[string], variant: string) {
	if (variant === 'unresolved') return { ...props, scope: null, index: null, commits: [] };
	if (variant === 'no-repository') return { ...props, repository: null };
	if (variant === 'long-repository')
		return {
			...props,
			repository:
				'Orders workspace with a deliberately long repository name for responsive navigation'
		};
	if (variant === 'pages')
		return {
			...props,
			scope: {
				...d.shown.scope,
				mode: 'current',
				location: { ...d.navigation.route, category: 'pages', entity: undefined }
			}
		};
	if (variant === 'historical')
		return { ...props, scope: { ...d.shown.scope, commit: d.commits.first, atTip: false } };
	return props;
}

function harnessHarnessSelectorsProps(props: PreviewCases[string], variant: string) {
	if (variant === 'comparison')
		return { ...props, bases: d.index.revisions, from: d.commits.first };
	if (variant === 'empty')
		return {
			...props,
			index: { ...d.index, branches: [] },
			branch: '',
			commit: '',
			commits: [],
			bases: []
		};
	if (variant === 'long')
		return {
			...props,
			index: {
				...d.index,
				branches: [
					{
						name: 'feature/orders/long-branch-name-for-responsive-selector',
						head: d.commits.middle
					}
				]
			},
			branch: 'feature/orders/long-branch-name-for-responsive-selector'
		};
	return {
		...props,
		tip: {
			note: 'Latest branch tip',
			viewed: 'Selected historical revision',
			href: variant === 'at-tip' ? null : '#tip',
			onfollow: () => {}
		}
	};
}

function harnessHarnessConsoleProps(props: PreviewCases[string], variant: string) {
	return variant === 'missing' ? { ...props, path: '/branch/not-a-real-branch/components' } : props;
}
