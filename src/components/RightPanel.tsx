import React, { useState, useEffect } from "react";
import {
  Search,
  Sparkles,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Network,
  Layers,
  FileText,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { SearchResult } from "../types";

// Prefer simple HTML parsing or rendering markdown natively using responsive classes.
interface RightPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onNavigateToResult: (docId: string, pageNum: number) => void;
  semanticSynthesis: string;
  isSynthesizing: boolean;
  onTriggerSynthesis: (term: string) => void;
  onClearSynthesis: () => void;
  allTermsIndexRef: { term: string; count: number }[];
}

export default function RightPanel({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onNavigateToResult,
  semanticSynthesis,
  isSynthesizing,
  onTriggerSynthesis,
  onClearSynthesis,
  allTermsIndexRef,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"exact" | "ai-synthesis">("exact");
  const [scratchpadText, setScratchpadText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  // Fallback regex cleaning
  const regexCleanText = (text: string) => {
    let clean = text || "";
    clean = clean.replace(/-\s*\n/g, "");
    clean = clean.replace(/(?<!\n)\n(?!\n)/g, " ");
    clean = clean.replace(/[ \t]+/g, " ");
    return clean.trim();
  };

  const handleCleanText = async () => {
    if (!scratchpadText.trim()) return;

    setIsCleaning(true);
    try {
      // Create an AbortController for a timeout (e.g. 10 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/clean-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scratchpadText }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("API call failed");
      }

      const data = await res.json();
      if (data.cleanText) {
        setScratchpadText(data.cleanText);
      } else {
        throw new Error("No clean text returned");
      }
    } catch (err) {
      console.error("AI clean failed, falling back to regex:", err);
      // Fallback to local regex clean
      setScratchpadText(regexCleanText(scratchpadText));
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(scratchpadText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain");
    const cleanedText = regexCleanText(pastedText);

    // insert cleaned text at selection or replace
    const selectionStart = e.currentTarget.selectionStart;
    const selectionEnd = e.currentTarget.selectionEnd;

    const newText =
      scratchpadText.substring(0, selectionStart) +
      cleanedText +
      scratchpadText.substring(selectionEnd);
    setScratchpadText(newText);
  };

  // Trigger search on mount/update when searchQuery prop changes
  useEffect(() => {
    if (searchQuery) {
      setActiveTab("exact");
    }
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled reactively by App.tsx, but this acts as an interface safeguard
  };

  const highlightKeyword = (text: string, kw: string) => {
    if (!kw) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${escapeRegExp(kw)})`, "gi"));
    return (
      <span className="leading-relaxed">
        {parts.map((p, i) =>
          p.toLowerCase() === kw.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-200 text-yellow-900 font-bold px-0.5 rounded-xs font-serif shadow-xs"
            >
              {p}
            </mark>
          ) : (
            p
          ),
        )}
      </span>
    );
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return (
    <div
      className="w-96 border-l border-slate-200 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800"
      id="right-panel-root"
    >
      {/* Search Bar Input Panel */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search matching words or phrases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-16 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50 text-slate-900 placeholder-slate-400 font-medium"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 select-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-900 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>

        {/* Tab Selection Navigation */}
        <div className="flex gap-2 mt-3 select-none">
          <button
            onClick={() => setActiveTab("exact")}
            className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "exact"
                ? "bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm"
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Exact ({searchResults.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("ai-synthesis")}
            className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "ai-synthesis"
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Synthesis</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Panels content */}
      <div className="flex-1 overflow-y-auto" id="right-panel-tab-views">
        {/* TAB 1: EXACT MATCHES */}
        {activeTab === "exact" && (
          <div className="p-4 space-y-4">
            {isSearching ? (
              <div className="p-12 text-center text-slate-600 space-y-2 flex flex-col items-center justify-center">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-xs font-bold font-sans">
                  Running Index Lookup...
                </p>
                <p className="text-[10px] text-slate-500 font-sans">
                  Scanning full-text indices and OCR maps globally
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 flex justify-between select-none">
                  <span>Matched Occurrences</span>
                  <span>{searchResults.length} instances</span>
                </div>

                {searchResults.map((res) => (
                  <div
                    key={res.id}
                    onClick={() =>
                      onNavigateToResult(res.documentId, res.pageNumber)
                    }
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5 select-none font-sans">
                      <span
                        className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold max-w-[170px] truncate"
                        title={res.documentTitle}
                      >
                        {res.documentTitle}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                        Page {res.pageNumber}{" "}
                        <ChevronRight className="w-2.5 h-2.5 text-indigo-500" />
                      </span>
                    </div>

                    <p className="text-[11px] font-serif text-slate-600 leading-relaxed italic border-l-2 border-indigo-300 pl-2 py-0.5">
                      {highlightKeyword(res.snippet, res.matchedText)}
                    </p>

                    <div className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider flex items-center justify-end gap-1 mt-2 font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Go to paragraph</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-xl max-w-sm mx-auto select-none mt-4 font-sans shadow-sm">
                <HelpCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  No Instances Found
                </p>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  The term{" "}
                  <span className="font-bold text-slate-900 font-serif">
                    "{searchQuery}"
                  </span>{" "}
                  is not located in any active documents. Try adding customized
                  Collections or Tagging structures.
                </p>
              </div>
            ) : (
              /* No Search entered yet - Show Thematic Clusters */
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-slate-700 text-xs shadow-sm">
                  <h4 className="font-bold text-indigo-700 mb-1 flex items-center gap-1 select-none">
                    <Network className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Cross-Document Referencing</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    To connect historical archives, highlight any keyword in the
                    center, click{" "}
                    <span className="font-semibold text-indigo-600 select-none">
                      "Query All"
                    </span>
                    , or click any thematic tag below. This displays overlapping
                    matches across your entire library.
                  </p>
                </div>

                <div className="space-y-2 select-none">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Systemic Keywords Indexed
                  </h4>

                  {allTermsIndexRef.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {allTermsIndexRef.map((termObj, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSearchQuery(termObj.term)}
                          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-left transition-colors cursor-pointer group flex items-center justify-between shadow-sm"
                        >
                          <span className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-600 truncate pr-2">
                            {termObj.term}
                          </span>
                          <span className="text-[9px] text-slate-500 bg-slate-50 group-hover:bg-indigo-50 group-hover:text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 font-sans border border-transparent group-hover:border-indigo-200">
                            {termObj.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic pl-1">
                      Generating keyword networks...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AI SYNTHESIS */}
        {activeTab === "ai-synthesis" && (
          <div className="p-4 space-y-4">
            {/* Search term context */}
            {searchQuery ? (
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between select-none shadow-sm">
                <div className="space-y-0.5 min-w-0 font-sans">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                    Synthesis Parameter
                  </p>
                  <p className="text-xs font-serif italic text-slate-900 truncate pr-4">
                    "{searchQuery}"
                  </p>
                </div>
                {!isSynthesizing && (
                  <button
                    onClick={() => onTriggerSynthesis(searchQuery)}
                    className="shrink-0 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded shadow-sm focus:outline-none cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-100 animate-pulse" />
                    <span>Run AI</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs text-center select-none font-sans shadow-sm">
                <Sparkles className="w-5 h-5 text-indigo-500 mx-auto mb-1.5 animate-pulse" />
                <p className="font-bold text-slate-800 text-xs">
                  Awaiting Analysis Subject
                </p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Highlight an intellectual concept (like{" "}
                  <span className="font-serif italic text-slate-900">
                    "semiotics"
                  </span>{" "}
                  or{" "}
                  <span className="font-serif italic text-slate-900">
                    "Claude Lévi-Strauss"
                  </span>
                  ) in the document, and choose{" "}
                  <span className="font-semibold text-indigo-600">
                    AI Synthesis
                  </span>{" "}
                  to cross-examine files.
                </p>
              </div>
            )}

            {isSynthesizing && (
              <div className="p-12 text-center text-slate-600 space-y-2.5 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg shadow-sm font-sans">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                <p className="text-xs font-bold text-indigo-600">
                  Contacting Academic Intellect...
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
                  Gemini is cross-referencing all pages, tracing semantic nodes,
                  and formulating a historical paradigm hypothesis...
                </p>
              </div>
            )}

            {!isSynthesizing && semanticSynthesis && (
              <div className="space-y-4 animate-fade-in font-sans">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 select-none">
                  <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />{" "}
                    GEMINI HYPOTHESIS DRAFT
                  </span>
                  <button
                    onClick={onClearSynthesis}
                    className="text-[9px] text-slate-500 hover:text-slate-800 cursor-pointer font-semibold"
                  >
                    Reset
                  </button>
                </div>

                {/* Synthesis Markdown Content display */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-slate-800 tracking-wide text-justify text-xs leading-relaxed max-w-none prose prose-slate font-serif whitespace-pre-line italic">
                  {semanticSynthesis}
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-800 leading-relaxed font-sans select-none shadow-sm">
                  <span className="font-bold uppercase tracking-wider block mb-0.5">
                    Note on index validation:
                  </span>
                  This synthesis was compiled by analyzing current pages in
                  memory using{" "}
                  <span className="font-mono">gemini-3.5-flash</span>. Check the
                  exact page occurrences in the sidebar tab to corroborate
                  citations.
                </div>
              </div>
            )}

            {!isSynthesizing && !semanticSynthesis && searchQuery && (
              <div className="text-center p-6 border border-slate-300 border-dashed rounded-lg bg-white select-none font-sans shadow-sm">
                <p className="text-xs text-slate-600">
                  Ready to map{" "}
                  <span className="font-bold text-slate-900 font-serif">
                    "{searchQuery}"
                  </span>{" "}
                  across resources.
                </p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">
                  Click "Run AI" to start
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart Scratchpad */}
      <div className="flex flex-col border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-600 font-sans">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Smart Scratchpad
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleCleanText()}
              disabled={isCleaning}
              className={`px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
                isCleaning
                  ? "bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 border-slate-200 cursor-pointer"
              }`}
              title="Fix hyphenation, line breaks, OCR errors, and whitespace via AI"
            >
              {isCleaning ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Cleaning...
                </>
              ) : (
                "Clean Text"
              )}
            </button>
            <button
              onClick={handleCopyToClipboard}
              className={`px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                copied
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200"
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                "Copy to Clipboard"
              )}
            </button>
          </div>
        </div>
        <textarea
          value={scratchpadText}
          onChange={(e) => setScratchpadText(e.target.value)}
          onPaste={handlePaste}
          disabled={isCleaning}
          placeholder="Paste copied PDF text here..."
          className={`w-full p-4 text-xs font-serif border-none focus:ring-0 resize-y min-h-[120px] max-h-[300px] outline-none transition-colors ${
            isCleaning
              ? "bg-slate-50 text-slate-400 cursor-not-allowed"
              : "bg-slate-50 focus:bg-white text-slate-700"
          }`}
        />
      </div>
    </div>
  );
}
