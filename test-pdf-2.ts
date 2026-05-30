import * as pdfParseStar from "pdf-parse";
import { Buffer } from "buffer";

async function test() {
  const dummyPdf = Buffer.from("%PDF-1.4\n1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n2 0 obj <</Type/Pages/Count 1/Kids[3 0 R]>> endobj\n3 0 obj <</Type/Page/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>> endobj\n4 0 obj <</Length 11>> stream\nBT\nET\nendstream endobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n0000000171 00000 n \ntrailer <</Size 5/Root 1 0 R>>\nstartxref\n232\n%%EOF", 'utf8');

  try {
     const pdfRaw = pdfParseStar.default || pdfParseStar;
     if (!pdfRaw.PDFParse) {
        console.log("No PDFParse found in", pdfRaw);
        return;
     }

     const parser = new pdfRaw.PDFParse({ data: dummyPdf });
     const result = await (parser as any).getText();
     console.log("Success:", result);
  } catch (e) {
     console.log("PDF Error:", e.name, e.message);
  }
}
test();
