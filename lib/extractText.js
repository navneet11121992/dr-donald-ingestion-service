const path = require('path');

/**
 * Extracts plain text from a file buffer based on its extension.
 * Supports: .pdf, .docx, .txt, .md, .csv (falls back to utf8 decode for unknown types)
 */
async function extractText(buffer, filename) {
	const ext = path.extname(filename).toLowerCase();

	switch (ext) {
		case '.pdf': {
			const pdfParse = require('pdf-parse');
			const result = await pdfParse(buffer);
			return result.text;
		}

		case '.docx': {
			const mammoth = require('mammoth');
			const result = await mammoth.extractRawText({ buffer });
			return result.value;
		}

		case '.txt':
		case '.md':
		case '.csv':
			return buffer.toString('utf8');

		default:
			console.warn(`No dedicated extractor for "${ext}", falling back to raw utf8 decode.`);
			return buffer.toString('utf8');
	}
}

module.exports = { extractText };
