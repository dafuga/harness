import type {
	CommittedFile,
	FileChange,
	WorktreeState
} from '../../../../../../src/core/activityTypes';
import type { PreviewCases } from './shared';

const paths = [
	'src/components/ActivityList.svelte',
	'src/components/ActivityFiles.svelte',
	'src/components/ActivityWork.svelte',
	'src/components/ProjectActivity.svelte',
	'test/components/project-activity.test.ts',
	'specification/scenarios/component-catalog-previews.json',
	'docs/activity.md'
];
const owners = ['activity-list', 'activity-files', 'activity-work', 'project-activity'];
const changes: FileChange[] = paths.map((path, index) => ({
	path,
	status: index === 4 ? 'added' : 'modified',
	units: owners[index] ? [`reports.component.${owners[index]}`] : []
}));

/** Use a readable synthetic hash for the standalone committed-file example. */
export function activityFilesPreview(files: CommittedFile[]) {
	return files.map((file) => ({ ...file, commit: 'b04e19f52a61c374d8f090b8a3e67c12451fd903' }));
}

/** Vary checkout and committed lists without changing the component's inputs. */
export function activityFileVariant(props: PreviewCases[string], variant: string) {
	const files = props.files as CommittedFile[];
	const trees = props.worktrees as WorktreeState[];
	if (variant === 'recorded') return { ...props, worktrees: null, registry: 'Recorded commit' };
	if (variant === 'clean') return { ...props, worktrees: [{ ...trees[0], changes: [] }] };
	if (variant === 'empty') return { ...props, files: [], worktrees: [] };
	if (variant === 'truncated')
		return {
			...props,
			worktrees: [{ ...trees[0], truncated: true, changes: [changes[0], changes[1], changes[6]] }]
		};
	if (variant === 'multiple-checkouts')
		return {
			...props,
			worktrees: [
				trees[0],
				{
					...trees[0],
					name: 'Feature checkout',
					branch: 'feature/activity',
					primary: false,
					changes: changes.slice(1, 2)
				}
			]
		};
	if (variant === 'many-uncommitted' || variant === 'expanded-uncommitted')
		return { ...props, worktrees: [{ ...trees[0], changes }] };
	if (variant === 'many-committed' || variant === 'expanded-committed')
		return { ...props, files: changes.map((change) => ({ ...files[0], ...change })) };
	return null;
}
