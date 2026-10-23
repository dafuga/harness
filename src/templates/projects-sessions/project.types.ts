export type ProjectKind = 'app' | 'lib' | 'game';

export interface ProjectTemplateInput {
	name: string;
	kind: ProjectKind;
	dimension?: '2d' | '3d';
}
