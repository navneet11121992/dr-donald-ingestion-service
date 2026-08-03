const path = require('path');

/**
 * Extracts plain text from a file buffer based on its extension.
 * Supports: .pdf, .docx, .txt, .md, .csv (falls back to utf8 decode for unknown types)
 */
// async function extractText(buffer, filename) {
// 	const ext = path.extname(filename).toLowerCase();
// 	console.log('[extract] MODULE LOADED FROM', __filename);
// 	switch (ext) {
// 		case '.pdf': {
// 			const pdfParse = require('pdf-parse');
// 			const result = await pdfParse(buffer);
// 			return result.text;
// 		}

// 		case '.docx': {
// 			const mammoth = require('mammoth');
// 			const result = await mammoth.extractRawText({ buffer });
// 			return result.value;
// 		}

// 		case '.txt':
// 		case '.md':
// 		case '.csv':
// 			return buffer.toString('utf8');

// 		default:
// 			console.warn(`No dedicated extractor for "${ext}", falling back to raw utf8 decode.`);
// 			return buffer.toString('utf8');
// 	}
// }

// module.exports = { extractText };


// OCR handling

// const path = require('path');

console.log('[extract] MODULE LOADED FROM', __filename);

const MIN_CHARS_PER_PAGE = parseInt(process.env.MIN_CHARS_PER_PAGE || '100', 10);
const OCR_ENABLED = process.env.OCR_ENABLED !== 'false';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp'];

async function extractText(buffer, filename) {
	const ext = path.extname(filename).toLowerCase();

	if (ext === '.pdf') {
		return extractPdf(buffer, filename);
	}

	if (IMAGE_EXTS.includes(ext)) {
		if (!OCR_ENABLED) return { text: '', method: 'ocr-disabled' };
		const { ocrImageBuffer } = require('./utils/ocr');
		return { text: await ocrImageBuffer(buffer), method: 'ocr' };
	}

	switch (ext) {
		case '.docx': {
			const mammoth = require('mammoth');
			const result = await mammoth.extractRawText({ buffer });
			return { text: result.value, method: 'mammoth' };
		}
		case '.txt':
		case '.md':
		case '.csv':
			return { text: buffer.toString('utf8'), method: 'utf8' };
		default:
			console.warn(`[extract] No dedicated extractor for "${ext}", raw utf8 decode.`);
			return { text: buffer.toString('utf8'), method: 'utf8-fallback' };
	}
}

async function extractPdf(buffer, filename) {
	const pdfParse = require('pdf-parse');

	let text = '';
	let numpages = 1;

	try {
		const result = await pdfParse(buffer);
		text = (result.text || '').trim();
		numpages = result.numpages || 1;
	} catch (err) {
		console.warn(`[extract] pdf-parse failed for ${filename}: ${err.message}`);
	}

	const density = text.replace(/\s+/g, ' ').length / Math.max(numpages, 1);
	console.log(`[extract] ${filename}: ${text.length} chars, ${numpages} page(s), ${Math.round(density)} chars/page`);

	if (density >= MIN_CHARS_PER_PAGE) {
		return { text, method: 'pdf-text-layer' };
	}

	if (!OCR_ENABLED) {
		return { text, method: 'ocr-disabled' };
	}

	console.log(`[extract] Text layer too thin — falling back to OCR`);

	try {
		const { ocrPdfBuffer } = require('./utils/ocr');
		const ocrText = await ocrPdfBuffer(buffer);
		return ocrText.length > text.length
			? { text: ocrText, method: 'ocr' }
			: { text, method: 'pdf-text-layer' };
	} catch (err) {
		console.error(`[extract] OCR FAILED for ${filename}:`, err);
		return { text, method: 'ocr-failed' };
	}
}

module.exports = { extractText };