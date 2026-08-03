const { pdf } = require('pdf-to-img');
const { createWorker } = require('tesseract.js');

const OCR_SCALE = parseFloat(process.env.OCR_SCALE || '2.0');
const OCR_MAX_PAGES = parseInt(process.env.OCR_MAX_PAGES || '20', 10);
const OCR_LANG = process.env.OCR_LANG || 'eng';

async function ocrPdfBuffer(buffer) {
	console.log(`[ocr] Starting OCR (scale ${OCR_SCALE}, max ${OCR_MAX_PAGES} pages)`);

	const doc = await pdf(buffer, { scale: OCR_SCALE });
	const worker = await createWorker(OCR_LANG);

	try {
		const out = [];
		let i = 0;
		for await (const page of doc) {
			if (++i > OCR_MAX_PAGES) {
				console.log(`[ocr] Hit page cap at ${OCR_MAX_PAGES}, stopping`);
				break;
			}
			const { data } = await worker.recognize(page);
			const t = (data.text || '').trim();
			console.log(`[ocr] page ${i}: ${t.length} chars, confidence ${Math.round(data.confidence)}`);
			if (t) out.push(t);
		}
		const result = out.join('\n\n');
		console.log(`[ocr] Finished: ${result.length} chars from ${i} page(s)`);
		return result;
	} finally {
		await worker.terminate();
	}
}

async function ocrImageBuffer(buffer) {
	const worker = await createWorker(OCR_LANG);
	try {
		const { data } = await worker.recognize(buffer);
		return (data.text || '').trim();
	} finally {
		await worker.terminate();
	}
}

module.exports = { ocrPdfBuffer, ocrImageBuffer };