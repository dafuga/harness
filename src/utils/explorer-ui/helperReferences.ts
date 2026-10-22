export interface HelperBinding {
	specifier?: string;
	imported: string;
}

export interface HelperReference extends HelperBinding {
	caller: string | null;
	/** True only for the callee of an actual new expression. */
	construct?: boolean;
}

export interface ClassFacts {
	name: string;
	abstract: boolean;
	methods: string[];
	base?: HelperBinding;
}

export interface HelperFacts {
	references: HelperReference[];
	classes?: ClassFacts[];
	forwards: Array<HelperBinding & { name: string }>;
}

export { helperReferences } from '../../services/explorer-ui/revision-detail-service/helperReferences';
