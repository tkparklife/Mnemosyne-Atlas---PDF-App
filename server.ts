import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfRaw = require("pdf-parse");
const pdf = typeof pdfRaw === "function" ? pdfRaw : (pdfRaw && pdfRaw.default ? pdfRaw.default : pdfRaw);

// Ensure we have access to process.env
import dotenv from "dotenv";
dotenv.config();

const PORT = 3000;

interface PDFPage {
  pageNumber: number;
  rawText: string;
  summary?: string;
  keyTerms?: string[];
}

interface PDFDocument {
  id: string;
  title: string;
  description?: string;
  fileSize?: string;
  uploadDate: string;
  pages: PDFPage[];
  collections: string[]; // collection IDs
  totalPages: number;
  ocrApplied: boolean;
  fileType: 'pdf' | 'image' | 'text';
  fileData?: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
}

// In-Memory Database for preview persistence
class KnowledgeDatabase {
  documents: PDFDocument[] = [];
  collections: Collection[] = [];

  constructor() {
    this.seedDefaultCollections();
    this.seedDefaultDocuments();
  }

  private seedDefaultCollections() {
    this.collections = [
      { id: "col-semiotics", name: "Semiotics & Lingustics", description: "Texts detailing sign systems, semantic fields, and structural linguistics.", color: "rose" },
      { id: "col-archives", name: "Historical Methodology", description: "Archives, historiographical analysis, and empirical frameworks.", color: "amber" },
      { id: "col-philosophy", name: "Symbolic Philosophy", description: "Symbolic architectures and intellectual structuralism.", color: "indigo" },
    ];
  }

  private seedDefaultDocuments() {
    this.documents = [
      {
        id: "doc-semiotics-history",
        title: "The Semiotics of History: Sign Systems in Archive Coding",
        description: "A foundational text investigating how historical facts are structured as symbolic signs, utilizing theories from De Saussure and Peirce to reconstruct historical consciousness.",
        fileSize: "1.4 MB",
        uploadDate: "2026-05-28",
        totalPages: 4,
        ocrApplied: true,
        fileType: "pdf",
        collections: ["col-semiotics", "col-archives"],
        pages: [
          {
            pageNumber: 1,
            rawText: `The semiotics of history begins at the intersection of textuality and chronological records. To construct a historical system, one does not merely list sequence events; one decodes signs. According to Ferdinand de Saussure, a sign is composed of a signifier and a signified. In archival structures, the document remains a latent signifier waiting for structural semiotics to elicit its final meaning. Consequently, primary sources represent a network of shifting symbols that historians must carefully index to build out their systemic representations of human history.`,
            summary: "Introduction to historical semiotics and sign-decoding in archives.",
            keyTerms: ["semiotics", "signified", "signifier", "Ferdinand de Saussure", "symbolic systems"]
          },
          {
            pageNumber: 2,
            rawText: `While Saussure advocated a dyadic model, Charles Sanders Peirce formulated a triadic system of semiotics: the representamen, the object, and the interpretant. This Peirce-style historicism holds that signs develop dynamically. A 17th-century administrative log does not merely refer to transactions, but interprets previous socio-economic relations. Thus, when researching historical semiotics, Peirce provides the logical tools to analyze how meaning propagates over time and within different cultures.`,
            summary: "Contrasting Saussure and Charles Sanders Peirce’s semiotic models in historicism.",
            keyTerms: ["Charles Sanders Peirce", "semiotics", "interpretant", "triadic model", "historical signs"]
          },
          {
            pageNumber: 3,
            rawText: `Through structural linguistics, we see historical events as signs within a larger narrative. For instance, the transition of currency from gold coins to electronic ledger balances is a semiotic shift. This semiotic transformation creates a new historical epoch, governed by structural codes rather than physical assets. Scholars in historiography must catalog these linguistic shifts to capture the true structural depth of administrative changes.`,
            summary: "Analyzing economic transitions as semiotic shifts in narrative empires.",
            keyTerms: ["semiotics", "linguistics", "narrative structures", "structuralism", "historiography"]
          },
          {
            pageNumber: 4,
            rawText: `Ultimately, the semiological analysis of historical periods reveals that history is a dynamic, multi-layered library. By tracking repeating occurrences of concepts like 'sovereignty' or 'semiotics' across unrelated letters, public laws, and theological treatises, we can map the latent paradigm of an era. The goal of this PDF database is to enable exactly this type of comprehensive cross-referencing and deep archive lookup.`,
            summary: "Concluding thoughts on mapping paradigms using cross-referencing indices.",
            keyTerms: ["semiotics", "cross-referencing", "sovereignty", "archival database", "linguistics"]
          }
        ]
      },
      {
        id: "doc-historiography-empires",
        title: "Historiography of Empire: Narrative, Symbols, and Structural Cycles",
        description: "An examination of cyclical imperial power. Focuses on the physical and symbolic representations used by successive Roman and colonial empires to enforce political authority.",
        fileSize: "2.8 MB",
        uploadDate: "2026-05-29",
        totalPages: 3,
        ocrApplied: false,
        fileType: "pdf",
        collections: ["col-archives", "col-philosophy"],
        pages: [
          {
            pageNumber: 1,
            rawText: `Historiographical debates often center on the driving forces behind imperial lifecycle stages. Gibbon's decline and fall hypothesis traces spiritual decay, while modern structural theory notes ecological margins. What both schools ignore is the sovereign symbolization system. Empires do not rule merely through armies; they conquer with signs. The Roman eagle, the colonial stamp, and the corporate logo represent semiotic networks of power that establish long-term political authority.`,
            summary: "Analyzing historical theories of imperial cyles and sovereign symbolization.",
            keyTerms: ["historiography", "sovereignty", "symbolic networks", "Roman Empire", "Edward Gibbon", "semiotics"]
          },
          {
            pageNumber: 2,
            rawText: `In Roman Empire studies, the coin represents the ultimate semiological instrument. Stamped with the emperor's likeness, the silver denarius served as an indexical sign of state presence in remote provinces. Consequently, monetary transactions were daily confirmations of loyalty and authority. When localized tribes transacted, they engaged in a semiotic ritual that reinforced the empire's overarching narrative framework.`,
            summary: "The Roman denarius as a semiological and indexical sign of political authority.",
            keyTerms: ["Roman Empire", "semiotics", "loyalty", "narrative structures", "semiology"]
          },
          {
            pageNumber: 3,
            rawText: `When historians compile these imperial artifacts, cross-referencing becomes vital. By cross-referencing monetary records against remote archeological inscriptions, we uncover systemic leaks. The sign of the emperor is gradually replaced by local marks, indicating a breakdown in the structural semiological cycle. This deterioration precedes the physical collapse of provincial garrisons by several decades.`,
            summary: "Predicting imperial breakdown through cross-referencing semiotic changes.",
            keyTerms: ["cross-referencing", "semiology", "structural cycles", "historiography"]
          }
        ]
      },
      {
        id: "doc-symbolic-rituals",
        title: "Linguistic Rituals and Symbolic Anthropological Structures",
        description: "An anthropological study of repetitive rituals as semiological structures of communication, contrasting Levi-Strauss' structuralism against postmodern semiotic critiques.",
        fileSize: "950 KB",
        uploadDate: "2026-05-25",
        totalPages: 2,
        ocrApplied: true,
        fileType: "text",
        collections: ["col-semiotics", "col-philosophy"],
        pages: [
          {
            pageNumber: 1,
            rawText: `Anthropology and structural linguistics merged in the mid-20th century to create symbolic anthropology. Claude Lévi-Strauss proposed that myths are structured like languages, organized into binary oppositions. Within this structural framework, cultural rituals are communicative enactments: their components are symbols in an elaborate linguistic system. To understand a sacred dance, one must decode its structural grammar, viewing every gesture as a signifier.`,
            summary: "Claude Lévi-Strauss and binary structures in cultural myths and rituals.",
            keyTerms: ["Claude Lévi-Strauss", "symbols", "linguistics", "structuralism", "rituals", "signifier"]
          },
          {
            pageNumber: 2,
            rawText: `POSTMODERN CRITIQUE OF STRUCTURALISM: Scholars like Derrida argued that binary setups lock in false assumptions. Instead of closed structures, they propose open-ended semiotics where meaning is constantly deferred. There is no ultimate referent; every sign points only to other signs. Under this postmodern view, our historical records are infinite networks of signs where concepts like 'semiotics' or 'structural systems' are in constant play, offering infinite paths for deep cross-referencing.`,
            summary: "Postmodern semiotics and the open-ended deferral of historical signs.",
            keyTerms: ["semiotics", "postmodernism", "Jacques Derrida", "structuralism", "cross-referencing"]
          }
        ]
      }
    ];
  }
}

const db = new KnowledgeDatabase();

async function parsePDFWithPdfParse(fileBuffer: Buffer): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];

  try {
    const parser = new pdfRaw.PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    
    if (!result || !Array.isArray(result.pages)) {
      throw new Error("Failed to parse pages array from PDF");
    }

    const stopWords = new Set([
      "the", "and", "a", "of", "to", "in", "is", "that", "it", "on", "by", "for", "with", "as", "an", "at", 
      "this", "but", "his", "are", "not", "from", "they", "was", "or", "an", "be", "were", "which", "their", 
      "what", "there", "has", "have", "more", "one", "all", "so", "about", "who", "whom", "whose", "would",
      "than", "first", "other", "into", "page", "empty", "contains", "analysis"
    ]);

    const commonAcademic = ["semiotics", "linguistics", "peirce", "saussure", "empire", "ritual", "philosophy", "history", "structuralism", "sovereignty", "symbolic", "anthropology", "postmodernism", "derrida", "narrative", "archival", "paradigm", "deconstruction"];

    for (const pageItem of result.pages) {
      const pNum = pageItem.num || 1;
      const rawText = (pageItem.text || "").replace(/\s+/g, ' ').trim();

      const extractedTerms: string[] = [];
      const lowerText = rawText.toLowerCase();

      commonAcademic.forEach(term => {
        if (lowerText.includes(term) && !extractedTerms.includes(term)) {
          extractedTerms.push(term);
        }
      });

      const words = rawText.match(/[A-Z][a-zA-Z-]{2,}/g) || [];
      for (const word of words) {
        const lowerWord = word.toLowerCase();
        if (!stopWords.has(lowerWord) && !extractedTerms.some(t => t.toLowerCase() === lowerWord)) {
          extractedTerms.push(word);
          if (extractedTerms.length >= 5) break;
        }
      }

      if (extractedTerms.length === 0) {
        extractedTerms.push("manuscript", "page", "reading");
      }

      let summaryStr = `Analysis of page ${pNum} focusing on key conceptual markers.`;
      const sentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
      if (sentences.length > 0) {
        const chosenSentence = sentences[0];
        if (chosenSentence.length < 150) {
          summaryStr = chosenSentence + ".";
        } else {
          summaryStr = chosenSentence.substring(0, 147) + "...";
        }
      }

      pages.push({
        pageNumber: pNum,
        rawText: rawText || `[Empty page ${pNum}]`,
        summary: summaryStr,
        keyTerms: extractedTerms.slice(0, 6)
      });
    }

    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    return pages;

  } catch (err) {
    console.error("Internal pdf-parse engine error:", err);
    throw err;
  }
}

async function startServer() {
  const app = express();

  // Middleware for parsing large payloads (base64 documents)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Shared Gemini client utility (uses GEMINI_API_KEY injected securely)
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // --- API Routes ---

  // 1. Get List of all Documents
  app.get("/api/documents", (req: Request, res: Response) => {
    res.json(db.documents);
  });

  // 2. Create/Upload a new Document (OCR & parsing)
  app.post("/api/documents/upload", async (req: Request, res: Response) => {
    try {
      const { title, fileData, mimeType, fileSize, fileType, collectionIds } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: "Missing fileData payload" });
      }

      const id = "doc-" + Date.now();
      const uploadDate = new Date().toISOString().split('T')[0];

      // Clean metadata and default structure
      const newDoc: PDFDocument = {
        id,
        title: title || "Uploaded Document",
        description: `Ingested through pipeline on ${uploadDate}`,
        fileSize: fileSize || "Unknown size",
        uploadDate,
        pages: [],
        collections: Array.isArray(collectionIds) ? collectionIds : [],
        totalPages: 1,
        ocrApplied: false,
        fileType: fileType || 'pdf',
        fileData: fileData
      };

      // Determine MIME Type category
      const isPdfFile = fileType === 'pdf' || mimeType?.includes("pdf") || title?.toLowerCase().endsWith(".pdf");
      const isOcrNeeded = mimeType?.includes("image") || fileType === 'image' || title?.toLowerCase().endsWith(".png") || title?.toLowerCase().endsWith(".jpeg");

      if (isPdfFile) {
        try {
          console.log(`PDF Document detected ('${title}'). Starting high-accuracy direct pdf-parse extraction of all pages...`);
          const base64Clean = fileData.replace(/^data:.*;base64,/, "");
          
          if (!/^[A-Za-z0-9+/=\s]+$/.test(base64Clean.substring(0, 100)) && base64Clean.length > 0) {
            console.error("Invalid base64 string prefix before decoding detected:", base64Clean.substring(0, 50));
            throw new Error("Pipeline Ingestion Failed. The string did not match the expected pattern. (Invalid Base64 format)");
          }

          const buffer = Buffer.from(base64Clean, 'base64');
          
          const parsedPages = await parsePDFWithPdfParse(buffer);
          
          if (parsedPages && parsedPages.length > 0) {
            newDoc.pages = parsedPages;
            newDoc.totalPages = parsedPages.length;
            newDoc.ocrApplied = false;
            newDoc.description = `Fully parsed and indexed all ${parsedPages.length} pages of the uploaded manuscript.`;
          } else {
            throw new Error("No pages parsed from the PDF document");
          }
        } catch (pdfErr: any) {
          console.error("Direct PDF parsing failed, trying fallback:", pdfErr);
          newDoc.pages = createFallbackPagesFromPayload(title, fileData);
          newDoc.totalPages = newDoc.pages.length;
        }
      } else if (isOcrNeeded && ai) {
        try {
          console.log(`Instructing Gemini to extract text via OCR. Target file mimeType: ${mimeType || 'image/png'}`);
          
          const base64Clean = fileData.replace(/^data:.*;base64,/, "");

          const promptText = `
            You are a high-performance OCR, document processing, and philosophical knowledge extraction assistant.
            Please extract the complete text content of this document page by page.
            Analyze the text, format it cleanly, and represent the document structure.
            Output your assessment ONLY as a raw, single JSON array matching this TypeScript structure:
            
            [
              {
                "pageNumber": number,
                "rawText": "full clean extracted text of this specific page...",
                "summary": "one-sentence summary of this page's academic or descriptive topic",
                "keyTerms": ["list", "of", "important", "academic", "entities", "or", "terms", "on", "this", "page"]
              }
            ]
            
            Do NOT include markdown formatting wrappers like \`\`\`json or \`\`\`. Start your response with [ and end with ]. Ensure it parses as standard JSON.
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              {
                inlineData: {
                  data: base64Clean,
                  mimeType: mimeType || "image/png"
                }
              },
              promptText
            ]
          });

          const rawTextResponse = response.text || "";
          console.log("Raw response from Gemini OCR engine:", rawTextResponse.substring(0, 400));

          // Parse JSON contents safely
          let jsonClean = rawTextResponse.trim();
          if (jsonClean.startsWith("```json")) {
            jsonClean = jsonClean.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
          } else if (jsonClean.startsWith("```")) {
            jsonClean = jsonClean.replace(/^```\s*/, "").replace(/\s*```$/, "");
          }

          const parsedPages = JSON.parse(jsonClean);

          if (Array.isArray(parsedPages) && parsedPages.length > 0) {
            newDoc.pages = parsedPages;
            newDoc.totalPages = parsedPages.length;
            newDoc.ocrApplied = true;
            newDoc.description = `Analyzed and fully indexed by Gemini 3.5. Contains ${newDoc.totalPages} page(s). Key terms extraction completed successfully.`;
          } else {
            throw new Error("Parsed pages format is not an array");
          }

        } catch (gemInIErr) {
          console.error("Gemini OCR operation failed, initiating fallback parser:", gemInIErr);
          newDoc.pages = createFallbackPagesFromPayload(title, fileData);
          newDoc.totalPages = newDoc.pages.length;
          newDoc.description = `Ingested with standard text indexing. [Note: Client side OCR fallback triggered]`;
        }
      } else {
        console.warn("Standard raw text processing fallback triggered...");
        newDoc.pages = createFallbackPagesFromPayload(title, fileData);
        newDoc.totalPages = newDoc.pages.length;
        newDoc.description = `Ingested with standard text indexing. (Connect Gemini API Key for fully automated OCR analysis)`;
      }

      db.documents.push(newDoc);
      res.status(201).json(newDoc);
    } catch (err: any) {
      console.error("Critical upload error:", err);
      res.status(500).json({ error: "Server failed to process file upload", details: err?.message });
    }
  });

  // Helper local fallback database index generator
  function createFallbackPagesFromPayload(title: string, fileData: string): PDFPage[] {
    // Attempt to salvage any readable text if base64 contains standard ASCII or text
    let recoveredText = "";
    try {
      const base64Clean = fileData.replace(/^data:.*;base64,/, "");
      const decoded = Buffer.from(base64Clean, 'base64').toString('utf-8');
      // If indeed utf8 text
      if (/^[a-zA-Z0-9\s\.,;:\(\)\/&\-\n_"'\?!]*$/.test(decoded.substring(0, 100))) {
        recoveredText = decoded;
      }
    } catch (_) {}

    const textToUse = recoveredText || `This is the auto-extracted textual surface of the uploaded file '${title}'. Standard metadata extraction occurred. This document has been added to the search index. In order to perform complete image OCR processing and deep symbolic key terms analysis, configure a Gemini API Key under Settings > Secrets.`;
    
    // Generate a beautiful, structured multi-page index based on document text chunks
    const words = textToUse.split(/\s+/);
    const wordsPerPage = 200;
    const pages: PDFPage[] = [];
    
    for (let i = 0, pageNum = 1; i < words.length; i += wordsPerPage, pageNum++) {
      const pageWords = words.slice(i, i + wordsPerPage);
      const rawText = pageWords.join(" ");
      
      // Auto-extract primitive key-terms
      const lowerText = rawText.toLowerCase();
      const terms: string[] = [];
      const commonEntities = ["semiotics", "linguistics", "peirce", "saussure", "empire", "ritual", "philosophy", "history", "structuralism", "sovereignty", "symbolic"];
      commonEntities.forEach(ent => {
        if (lowerText.includes(ent) && !terms.includes(ent)) {
          terms.push(ent);
        }
      });
      if (terms.length === 0) terms.push("document", "archive", "concept");

      pages.push({
        pageNumber: pageNum,
        rawText,
        summary: `Automated summary of page ${pageNum} focusing on textual index markers.`,
        keyTerms: terms
      });
    }

    return pages;
  }

  // 3. Delete Document
  app.delete("/api/documents/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const index = db.documents.findIndex(d => d.id === id);
    if (index !== -1) {
      db.documents.splice(index, 1);
      return res.json({ success: true, message: "Document removed successfully" });
    }
    res.status(404).json({ error: "Document not found" });
  });

  // 4. Get Collections Tags list
  app.get("/api/collections", (req: Request, res: Response) => {
    res.json(db.collections);
  });

  // 5. Create a Collection Tag
  app.post("/api/collections", (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Collection name is required" });
    }

    const id = "col-" + name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    
    // Duplicity check
    if (db.collections.find(c => c.id === id)) {
      return res.status(400).json({ error: "Collection tag custom name already exists" });
    }

    const newCol: Collection = {
      id,
      name,
      description: description || "",
      color: color || "indigo"
    };

    db.collections.push(newCol);
    res.status(201).json(newCol);
  });

  // 6. Bind collections list to a specific document ID
  app.post("/api/documents/:id/collections", (req: Request, res: Response) => {
    const { id } = req.params;
    const { collectionIds } = req.body;

    if (!Array.isArray(collectionIds)) {
      return res.status(400).json({ error: "collectionIds must be an array" });
    }

    const doc = db.documents.find(d => d.id === id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    doc.collections = collectionIds;
    res.json(doc);
  });

  app.post("/api/clean-text", async (req: Request, res: Response) => {
    const rawText = req.body.text as string | undefined;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!ai) {
      return res.status(503).json({ error: "Gemini API key not configured" });
    }

    try {
      const prompt = `You are a text-correction engine. The user will provide text copied directly from a messy PDF. Your ONLY job is to fix OCR errors, stitch together hyphenated words, add missing spaces between combined words, and correct ligature misspellings (e.g., 'fi' misread as 'ft'). Preserve all original sentences, paragraphs, and academic meaning. Return ONLY the corrected text. Do not add conversational filler.\n\nRAW TEXT:\n${rawText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      if (!response.text) {
         throw new Error("No text returned from model");
      }

      res.json({ cleanText: response.text });
    } catch (e: any) {
      console.error("Clean text error:", e);
      res.status(500).json({ error: e.message || "Failed to process text" });
    }
  });

  // 7. Global Search Query indexing with rich snippets
  app.post("/api/search", (req: Request, res: Response) => {
    const query = (req.body.q as string || "").trim();
    if (!query) {
      return res.json([]);
    }

    const cleanQuery = query.toLowerCase();
    const results: any[] = [];

    db.documents.forEach(doc => {
      doc.pages.forEach(pg => {
        const text = pg.rawText;
        const lowerText = text.toLowerCase();
        
        let index = lowerText.indexOf(cleanQuery);
        let matchCount = 0;
        
        // Find multiple snippets per page if present (limit to 3 snippets per page for UI sanity)
        while (index !== -1 && matchCount < 3) {
          const start = Math.max(0, index - 50);
          const end = Math.min(text.length, index + query.length + 60);
          
          let snippet = text.substring(start, end);
          if (start > 0) snippet = "..." + snippet;
          if (end < text.length) snippet = snippet + "...";

          results.push({
            id: `${doc.id}-p${pg.pageNumber}-m${matchCount}-${index}`,
            documentId: doc.id,
            documentTitle: doc.title,
            pageNumber: pg.pageNumber,
            snippet,
            matchedText: text.substring(index, index + query.length)
          });

          matchCount++;
          index = lowerText.indexOf(cleanQuery, index + 1);
        }
      });
    });

    res.json(results);
  });

  // 8. AI Analysis/Semantics Cross-Referrer using Gemini
  app.post("/api/semantic-cross-reference", async (req: Request, res: Response) => {
    if (!ai) {
      return res.status(400).json({ 
        error: "Gemini API key is not configured.", 
        message: "Unable to run deep semantic synthesis because process.env.GEMINI_API_KEY is unset." 
      });
    }

    try {
      const { term } = req.body;
      if (!term) {
        return res.status(400).json({ error: "Missing 'term' payload parameter" });
      }

      // Pack active library page coordinates for Gemini to read
      const contextDocs = db.documents.map(d => ({
        id: d.id,
        title: d.title,
        pages: d.pages.map(p => ({
          num: p.pageNumber,
          text: p.rawText
        }))
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          You are an elite intellectual research synthesizer. Overlooking the attached archival database documents,
          perform a precise cross-referencing analysis for the term/concept/subject: "${term}".
          
          Review the complete documents detailed in this library JSON structure:
          ${JSON.stringify(contextDocs)}
          
          Synthesize how "${term}" behaves as a theoretical sign or concept across these archives:
          1. Trace overlapping meanings, linkages, or debates between authors / texts.
          2. Outline the semantic weight of this concept across the library.
          3. Propose a brief "intellectual lineage hypothesis" combining these documents.
          
          Your response must be in elegant markdown with concise bullet points and direct references to document titles. Keep it dense, academic, and highly professional.
        `
      });

      res.json({ synthesis: response.text || "No synthesis generated." });
    } catch (err: any) {
      console.error("Semantic analysis failed:", err);
      res.status(500).json({ error: "Semantic synthesis failed", details: err?.message });
    }
  });


  // --- Vite Dev Server Middleware vs Production Client serving ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Knowledge Platform Server listening on http://localhost:${PORT}`);
  });
}

startServer();
