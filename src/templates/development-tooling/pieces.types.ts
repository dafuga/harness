/** Project facts a scaffold needs beyond its name, read once by the generate workflow. */
export interface PieceContext {
	dimension?: '2d' | '3d';
	level?: 'molecule' | 'organism';
}
