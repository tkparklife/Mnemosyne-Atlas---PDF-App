import React, { useState, useEffect } from "react";
import LeftPanel from "./components/LeftPanel";
import CenterPanel from "./components/CenterPanel";
import RightPanel from "./components/RightPanel";
import { PDFDocument, Collection, Highlight, SearchResult } from "./types";
import { Sparkles, Layers, BookOpen, Clock, RefreshCw } from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activePageNumber, setActivePageNumber] = useState<number>(1);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Search Core
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Annotations / Highlights (Pragmatic Local Caching persistence)
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // AI Semantic Synthesis Integration State
  const [semanticSynthesis, setSemanticSynthesis] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Initial Boot loader
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Data Fetching from full-stack Express service
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [docsRes, colsRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/collections")
        ]);

        if (docsRes.ok && colsRes.ok) {
          const docs: PDFDocument[] = await docsRes.json();
          const cols: Collection[] = await colsRes.json();
          setDocuments(docs);
          setCollections(cols);

          // Auto select first document to populate dashboard immediately
          if (docs.length > 0) {
            setSelectedDocId(docs[0].id);
            setActivePageNumber(1);
          }
        }
      } catch (err) {
        console.error("Failed to load initial library seed parameters:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Recover highlights from browser cache
    const savedHL = localStorage.getItem("pdf_knowledge_highlights");
    if (savedHL) {
      try {
        setHighlights(JSON.parse(savedHL));
      } catch (_) {}
    }
  }, []);

  // 2. Sync highlights cache to browser
  const saveHighlightsLocal = (newHL: Highlight[]) => {
    setHighlights(newHL);
    localStorage.setItem("pdf_knowledge_highlights", JSON.stringify(newHL));
  };

  // 3. Debounced Exact Match global index search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delaySearch = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: searchQuery })
        });
        if (res.ok) {
          const matches = await res.json();
          setSearchResults(matches);
        }
      } catch (e) {
        console.error("Search query execution failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Action: Select document and default page 1
  const handleSelectDoc = (id: string) => {
    setSelectedDocId(id);
    setActivePageNumber(1);
  };

  // Action: Delete document
  const handleDeleteDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
        if (selectedDocId === id) {
          setSelectedDocId(null);
          setActivePageNumber(1);
        }
        // Remove highlights of deleted document
        const cleanedHighlights = highlights.filter(h => h.documentId !== id);
        saveHighlightsLocal(cleanedHighlights);
      }
    } catch (e) {
      console.error("Failed to delete document model:", e);
    }
  };

  // Action: Ingestion Upload Complete handler
  const handleUploadComplete = (newDoc: PDFDocument) => {
    setDocuments(prev => [newDoc, ...prev]);
    setSelectedDocId(newDoc.id);
    setActivePageNumber(1);
  };

  // Action: Create Collection Tag
  const handleAddCollection = async (name: string, description: string, color: string) => {
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color })
      });

      if (res.ok) {
        const newCol: Collection = await res.json();
        setCollections(prev => [...prev, newCol]);
      }
    } catch (e) {
      console.error("Collection creation failed:", e);
    }
  };

  // Action: Update Document Collections
  const handleUpdateDocCollections = async (docId: string, collectionIds: string[]) => {
    try {
      const res = await fetch(`/api/documents/${docId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds })
      });
      if (res.ok) {
        const updatedDoc: PDFDocument = await res.json();
        setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
      }
    } catch (e) {
      console.error("Failed to update collections", e);
    }
  };

  // Action: Capture text selection and push immediately to search index
  const handleSendToSearch = (term: string) => {
    setSearchQuery(term);
  };

  // Action: Trigger Gemini AI synthesized cross-reference report
  const handleTriggerSemanticSynthesis = async (term: string) => {
    setSemanticSynthesis("");
    setIsSynthesizing(true);
    try {
      const res = await fetch("/api/semantic-cross-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.details || errJson.error || "Synthesis error");
      }

      const data = await res.json();
      setSemanticSynthesis(data.synthesis);
    } catch (e: any) {
      console.error("AI Synthesis failure:", e);
      setSemanticSynthesis(`### Theoretical Analysis Error\n\nFailed to compile dynamic semantic synthesis for index: "${term}".\n\n**Detailed cause:** ${e.message || 'The index is currently locked.'}.\n\nEnsure process.env.GEMINI_API_KEY is configured under Secrets config.`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Action: Navigate directly to a specific search coordinate
  const handleNavigateToResult = (docId: string, pageNum: number) => {
    setSelectedDocId(docId);
    setActivePageNumber(pageNum);
  };

  const handleAddHighlight = (hl: Highlight) => {
    const updated = [hl, ...highlights];
    saveHighlightsLocal(updated);
  };

  // Calculate high frequency thematic clusters dynamically based on terms extracted in current documents
  const computeThematicClusters = (): { term: string; count: number }[] => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => {
      doc.pages.forEach(p => {
        p.keyTerms?.forEach(term => {
          const trimmed = term.trim().toLowerCase();
          if (trimmed) {
            // Capitalization formatting logic
            const formatted = term.charAt(0).toUpperCase() + term.slice(1);
            counts[formatted] = (counts[formatted] || 0) + 1;
          }
        });
      });
    });

    return Object.entries(counts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14); // Return top 14 items
  };

  const activeDoc = documents.find(d => d.id === selectedDocId) || null;
  const thematicClusters = computeThematicClusters();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center frosted-space-bg text-slate-800 gap-4" id="app-loading-state">
        <div className="relative flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border border-indigo-600/30 animate-ping"></div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
          Reconstructing Axiom Research Environment...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden text-slate-800 frosted-space-bg font-sans" id="app-workspace-root">
      
      {/* App Header / Toolbar */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-base">Mnemosyne Atlas</span>
        </div>
        <div className="flex items-center gap-6 select-none">
          <div className="flex items-center gap-2 text-[10px] font-bold px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full font-mono">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            OCR PIPELINE ACTIVE
          </div>
          <div className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold font-mono transition-all flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>UTC 12:20</span>
          </div>
        </div>
      </header>

      {/* Main Responsive 3-Panel Desk Framework with transparent glass panels */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Panel - Library View and Ingestion Section */}
        <LeftPanel
          documents={documents}
          collections={collections}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onDeleteDoc={handleDeleteDoc}
          onUploadComplete={handleUploadComplete}
          onAddCollection={handleAddCollection}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onUpdateDocCollections={handleUpdateDocCollections}
          onDeleteCollection={(id) => {
            setCollections(prev => prev.filter(c => c.id !== id));
            setDocuments(prev => prev.map(doc => ({
              ...doc,
              collections: doc.collections ? doc.collections.filter(cid => cid !== id) : []
            })));
            if (selectedCollectionId === id) {
              setSelectedCollectionId(null);
            }
          }}
        />

        {/* Center Panel - Main Document Reading space and Context Menu trigger */}
        <CenterPanel
          document={activeDoc}
          activePageNumber={activePageNumber}
          setActivePageNumber={setActivePageNumber}
          onSendToSearch={handleSendToSearch}
          onTriggerSemanticSynthesis={handleTriggerSemanticSynthesis}
          highlights={highlights}
          onAddHighlight={handleAddHighlight}
          onNavigateToResult={handleNavigateToResult}
          searchQuery={searchQuery}
        />

        {/* Right Panel - Dynamic Global Search and Dynamic AI Synthesizer */}
        <RightPanel
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onNavigateToResult={handleNavigateToResult}
          semanticSynthesis={semanticSynthesis}
          isSynthesizing={isSynthesizing}
          onTriggerSynthesis={handleTriggerSemanticSynthesis}
          onClearSynthesis={() => setSemanticSynthesis("")}
          allTermsIndexRef={thematicClusters}
        />

      </main>

      {/* Modern Status Footer Bar */}
      <footer className="h-8 border-t border-slate-200 bg-white flex items-center justify-between px-6 z-20 text-[10px] text-slate-500 shrink-0 select-none font-mono">
        <div className="flex items-center gap-4">
          <span>DB STATUS: <span className="text-emerald-600 font-bold">CONNECTED</span></span>
          <span className="text-slate-300">|</span>
          <span>INDEX SIZE: {documents.length > 0 ? `${(documents.length * 1.4).toFixed(1)} MB` : "0.0 MB"}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>CORES: 12 THREADS</span>
          <span className="text-slate-300">|</span>
          <span className="text-indigo-600">VER 2.1.0-STABLE</span>
        </div>
      </footer>

    </div>
  );
}
