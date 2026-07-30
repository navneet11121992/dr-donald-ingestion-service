
const {ApiError} = require('./utils/apiErrors');
function chunkText(text, chunkSize = 1000, overlap = 150) {
	const cleaned = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

	if (!cleaned) return [];
	if (overlap >= chunkSize) {
		// throw new Error('overlap must be smaller than chunkSize');
		throw new ApiError('overlap must be smaller than chunkSize');
	}

	const chunks = [];
	let start = 0;

	while (start < cleaned.length) {
		let end = Math.min(start + chunkSize, cleaned.length);
		if (end < cleaned.length) {
			const lookback = cleaned.slice(start, end);
			const lastBreak = Math.max(
				lookback.lastIndexOf('\n\n'),
				lookback.lastIndexOf('. '),
				lookback.lastIndexOf('.\n')
			);
			if (lastBreak > chunkSize * 0.5) {
				end = start + lastBreak + 1;
			}
		}

		const piece = cleaned.slice(start, end).trim();
		if (piece) chunks.push(piece);

		if (end >= cleaned.length) break;
		start = end - overlap;
	}

	return chunks;
}

module.exports = { chunkText };
