export type Header = {
	width: number;
	height: number;
	depth: number;
	color: number;
	interlace: number;
};

export type State = {
	header: Header;
	data: Uint8Array[];
	palette: number;
	transparency: boolean;
	started: boolean;
	closed: boolean;
	end: boolean;
};

export { hubPngChunks } from '../services/hub-projection-service/hubPngChunks';
