export interface PDFPage {
  pageNumber: number;
  rawText: string;
  summary?: string;
  keyTerms?: string[];
}

export interface PDFDocument {
  id: string;
  title: string;
  description?: string;
  fileSize?: string;
  uploadDate: string;
  pages: PDFPage[];
  collections: string[]; // Array of collection IDs
  totalPages: number;
  ocrApplied: boolean;
  fileType: 'pdf' | 'image' | 'text';
  fileData?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string; // Tailwind tint color (e.g., 'blue', 'orange', 'emerald')
}

export interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  comment?: string;
  createdAt: string;
  color: string; // Highlight background (e.g., 'yellow', 'cyan', 'rose')
}

export interface SearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  snippet: string;
  matchedText: string;
}

export interface IndexedConcept {
  term: string;
  occurrences: number;
  foundIn: {
    documentId: string;
    documentTitle: string;
    pageNumbers: number[];
  }[];
}
