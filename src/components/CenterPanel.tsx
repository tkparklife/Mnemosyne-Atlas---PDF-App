import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Highlighter, Search, Sparkles, Plus, BookOpen, Layers, Check, ZoomIn, ZoomOut, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { PDFDocument, PDFPage, Highlight } from "../types";

// Helper to convert data URL / Base64 to Blob
function dataURLtoBlob(dataStr: string) {
  try {
    let base64 = dataStr;
    let mime = 'application/pdf';
    
    if (dataStr.startsWith('data:')) {
      const parts = dataStr.split(',');
      mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      base64 = parts[1];
    }
    
    // Decode base64
    const bstr = atob(base64);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error("Failed to parse base64 file data string", err);
    throw err;
  }
}

// Helper hook to load PDF.js from CDN
function usePdfJs() {
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfjs((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        setPdfjs(lib);
      } else {
        setError("Failed to initialize PDF.js library instance.");
      }
    };
    script.onerror = () => {
      setError("Failed to load PDF.js engine CDN script.");
    };
    document.body.appendChild(script);
  }, []);

  return { pdfjs, error };
}

// PDF.js Page Rendering Subcomponent
interface VisualPdfPageProps {
  pdfDoc: any;
  pageNumber: number;
  zoomLevel: number;
  searchQuery?: string;
}

function VisualPdfPage({ pdfDoc, pageNumber, zoomLevel, searchQuery = "" }: VisualPdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutObserverRef = useRef<ResizeObserver | null>(null);
  const [renderState, setRenderState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const renderTaskRef = useRef<any>(null);
  const [textItems, setTextItems] = useState<any[]>([]);
  const [viewport, setViewport] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [layoutWidth, setLayoutWidth] = useState<number>(0);
  
  const handleLayoutRef = (node: HTMLDivElement | null) => {
    if (layoutObserverRef.current) {
      layoutObserverRef.current.disconnect();
    }
    if (node) {
      layoutObserverRef.current = new ResizeObserver(entries => {
        if (entries[0].contentRect.width > 0) {
          setLayoutWidth(entries[0].contentRect.width);
        }
      });
      layoutObserverRef.current.observe(node);
    }
  };

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(wrapperRef.current);
    
    return () => {
      observer.disconnect();
      if (layoutObserverRef.current) {
        layoutObserverRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    
    const renderPage = async () => {
      if (!pdfDoc || !containerWidth) return;
      setRenderState('loading');
      
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not get canvas 2D rendering context");

        // Calculate dynamic scale relative to container width (-40px for padding)
        const baseViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = containerWidth - 40;
        const fitScale = targetWidth / baseViewport.width;
        
        // Final scale based on UI zoom level
        const finalScale = fitScale * (zoomLevel / 100);
        const pageViewport = page.getViewport({ scale: finalScale });
        if (active) setViewport(pageViewport);

        // Explicitly set dimensions on canvas coordinates to avoid blank/collapsed size
        canvas.width = pageViewport.width;
        canvas.height = pageViewport.height;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: pageViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        // Fetch text content in parallel or sequentially
        page.getTextContent().then((content: any) => {
          if (active) setTextItems(content.items);
        }).catch((err: any) => {
          console.error("Text extraction error:", err);
        });

        await renderTask.promise;
        if (active) {
          setRenderState('success');
        }
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
          return;
        }
        console.error("Failed rendering visual page:", err);
        if (active) {
          setRenderState('error');
          setErrorMessage(err.message || 'Error occurred while drawing PDF visual canvas page');
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNumber, zoomLevel, containerWidth]);

  return (
    <div 
      ref={wrapperRef}
      className="relative w-full h-full max-w-full box-border flex flex-col items-center justify-center overflow-auto bg-[#E5E7EB] border border-slate-300 rounded min-h-[500px]" 
    >
      <style>{`
        .pdf-canvas-render {
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>
      
      {renderState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-15 gap-2 select-none">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-[10px] font-mono text-indigo-700 uppercase tracking-widest">Rendering Visual Canvas...</span>
        </div>
      )}
      
      {renderState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 border border-rose-200 p-4 text-center z-15 select-none">
          <AlertCircle className="w-6 h-6 text-rose-500 mb-1.5" />
          <div className="text-rose-600 text-[10px] font-bold font-mono uppercase tracking-wider mb-1">Canvas Draw Error</div>
          <div className="text-slate-600 text-[10.5px] font-sans max-w-xs">{errorMessage}</div>
        </div>
      )}

      {/* High precision dimension responsive element */}
      <div 
        ref={handleLayoutRef}
        className="relative max-w-full box-border shadow-md bg-white border border-slate-200 rounded"
        style={{ 
          width: renderState === 'success' && viewport ? viewport.width : 'auto', 
          height: renderState === 'success' && viewport ? viewport.height : 'auto',
          maxWidth: '100%',
          display: renderState === 'success' ? 'block' : 'none'
        }}
      >
        <canvas 
          ref={canvasRef} 
          className="block pdf-canvas-render"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        
        {/* Precise Text Layer */}
        {renderState === 'success' && viewport && textItems.length > 0 && (
          <div 
            className="z-10 pointer-events-auto select-text overflow-hidden pdf-text-layer-overlay"
          >
            <style>{`
              .pdf-text-layer-overlay {
                position: absolute !important;
                top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                width: 100% !important; height: 100% !important;
              }
              .pdf-text-layer ::selection { background: rgba(0, 153, 255, 0.3); color: transparent; }
              .pdf-text-layer span {
                color: transparent !important;
                line-height: 1 !important;
                white-space: pre !important;
                font-family: sans-serif !important;
              }
            `}</style>
            <div 
              className="pdf-text-layer relative"
              style={{
                width: viewport.width,
                height: viewport.height,
                transform: `scale(${layoutWidth > 0 ? layoutWidth / viewport.width : 1})`,
                transformOrigin: 'top left'
              }}
            >
            {textItems.map((item, idx) => {
              const pdfjs = (window as any).pdfjsLib;
              if (!pdfjs) return null;
              // tx is [scaleX, skewY, skewX, scaleY, x, y] in VIEWPORT pixels
              const tx = pdfjs.Util.transform(viewport.transform, item.transform);
              const scaleY = Math.abs(tx[3]);
              const scaleX = Math.abs(tx[0]) / (scaleY || 1);
              
              // tx[5] is the baseline Y coordinate from top. 
              // We set `top` to (baseline - scaleY * ~0.8) to align the bounding box.
              let renderStr: React.ReactNode = item.str;
              if (searchQuery && searchQuery.trim().length > 1) {
                const sq = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b(${sq})\\b`, 'gi');
                if (regex.test(item.str)) {
                  const parts = item.str.split(regex);
                  renderStr = parts.map((part, i) => 
                     part.toLowerCase() === searchQuery.trim().toLowerCase() 
                       ? <mark key={i} style={{ backgroundColor: 'rgba(0, 153, 255, 0.4)', color: 'transparent', borderRadius: '2px' }}>{part}</mark> 
                       : part
                  );
                }
              }

              return (
                <span 
                  key={idx} 
                  style={{
                    position: 'absolute',
                    left: `${tx[4]}px`,
                    top: `${tx[5] - scaleY * 0.8}px`,
                    fontSize: `${scaleY}px`,
                    transform: `scaleX(${scaleX})`,
                    transformOrigin: 'left bottom',
                    cursor: 'text'
                  }}
                >
                  {renderStr}
                </span>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

interface CenterPanelProps {
  document: PDFDocument | null;
  activePageNumber: number;
  setActivePageNumber: (num: number) => void;
  onSendToSearch: (term: string) => void;
  onTriggerSemanticSynthesis: (term: string) => void;
  highlights: Highlight[];
  onAddHighlight: (highlight: Highlight) => void;
  onNavigateToResult: (docId: string, pageNum: number) => void;
  searchQuery?: string;
}

export default function CenterPanel({
  document,
  activePageNumber,
  setActivePageNumber,
  onSendToSearch,
  onTriggerSemanticSynthesis,
  highlights,
  onAddHighlight,
  onNavigateToResult,
  searchQuery = ""
}: CenterPanelProps) {
  const [selectedText, setSelectedText] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [commentText, setCommentText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selectedColor, setSelectedColor] = useState("bg-yellow-105 border-yellow-300 ring-yellow-400");
  const [colorKey, setColorKey] = useState("yellow");
  const [tooltipPage, setTooltipPage] = useState<number>(1);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const { pdfjs, error: pdfjsLoadError } = usePdfJs();
  const [pdfSource, setPdfSource] = useState<any>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load pdfjs representation asynchronously
  useEffect(() => {
    if (!pdfjs || !document || document.fileType !== 'pdf' || !document.fileData) {
      setPdfDoc(null);
      return;
    }

    let active = true;
    setPdfLoading(true);
    setPdfError(null);

    const loadPDF = async () => {
      try {
        let pdfDataOrUrl: any = document.fileData;
        
        if (typeof document.fileData === 'string' && document.fileData.startsWith("data:")) {
          const parts = document.fileData.split(',');
          const base64 = parts[1];
          const bstr = atob(base64);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
           // Use Uint8Array directly here; it's cloned to worker 
           pdfDataOrUrl = { data: u8arr };
        }

        const loadingTask = pdfjs.getDocument(pdfDataOrUrl);
        const resolvedPdf = await loadingTask.promise;
        if (active) {
          setPdfDoc(resolvedPdf);
          setPdfLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading PDF document using pdfjs:", err);
        if (active) {
          setPdfError(err.message || "Failed to parse PDF binary pages");
          setPdfLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      active = false;
    };
  }, [pdfjs, document?.id, document?.fileData, document?.fileType]);

  // Clear selection and close tooltips when document switches
  useEffect(() => {
    setShowTooltip(false);
    setShowCommentInput(false);
    setSelectedText("");
  }, [document?.id]);

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#E5E7EB] p-8 border-r border-slate-200" id="center-panel-root">
        <div className="text-center max-w-sm font-sans">
          <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BookOpen className="w-6 h-6 text-indigo-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Select a Manuscript</h2>
          <p className="text-xs text-slate-500 leading-relaxed mt-1">
            Pick an item from the library on the left or upload a raw file to run the Gemini indexing pipeline.
          </p>
        </div>
      </div>
    );
  }

  const handlePageNavigation = (direction: 'next' | 'prev') => {
    if (direction === 'prev' && activePageNumber > 1) {
      setActivePageNumber(activePageNumber - 1);
    } else if (direction === 'next' && activePageNumber < document.totalPages) {
      setActivePageNumber(activePageNumber + 1);
    }
    // Clear selection state
    setShowTooltip(false);
    setShowCommentInput(false);
  };

  const handleMouseUp = (e: React.MouseEvent, pageNumber: number) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    let text = selection.getRangeAt(0).cloneContents().textContent || "";
    if (!text.trim()) {
      setShowTooltip(false);
      return;
    }
    
    // Aggressive regex sanitization:
    // Collapse internal line breaks and hyphens
    text = text.replace(/-\s*\n\s*/g, '').replace(/[\r\n\t]+/g, ' ').replace(/\s\s+/g, ' ').trim();
    
    // Remove trailing stray punctuation ONLY if it's a short selection or single word
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 3) {
      text = text.replace(/^[-\.,:;()[\]"'\s]+|[-\.,:;()[\]"'\s]+$/g, '');
    }

    if (text.length > 0 && text.length < 150) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const scrollerEl = scrollerRef.current;
      if (scrollerEl) {
        const scrollerRect = scrollerEl.getBoundingClientRect();
        setTooltipPos({
          top: rect.top - scrollerRect.top + scrollerEl.scrollTop - 52,
          left: rect.left - scrollerRect.left + scrollerEl.scrollLeft + (rect.width / 2) - 100
        });
      }
      setSelectedText(text);
      setTooltipPage(pageNumber);
      setShowTooltip(true);
      
      // Auto-trigger search automatically after valid selection drag
      onSendToSearch(text);
    } else {
      // Do not close tooltip immediately if user is clicking inside the tooltip/comment elements
      const target = e.target as HTMLElement;
      if (!target.closest("#selection-tooltip-dialog")) {
        setShowTooltip(false);
        setShowCommentInput(false);
      }
    }
  };

  const triggerSearch = () => {
    if (!selectedText) return;
    onSendToSearch(selectedText);
    setShowTooltip(false);
    setShowCommentInput(false);
    // Clear text selection natively
    window.getSelection()?.removeAllRanges();
  };

  const triggerSemanticAnalysis = () => {
    if (!selectedText) return;
    onTriggerSemanticSynthesis(selectedText);
    setShowTooltip(false);
    setShowCommentInput(false);
    window.getSelection()?.removeAllRanges();
  };

  const executeAddHighlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedText || !document) return;

    const targetPageNum = tooltipPage;

    const newHighlight: Highlight = {
      id: "hl-" + Date.now(),
      documentId: document.id,
      pageNumber: targetPageNum,
      text: selectedText,
      comment: commentText.trim() || undefined,
      createdAt: new Date().toLocaleDateString(),
      color: colorKey
    };

    onAddHighlight(newHighlight);
    setCommentText("");
    setShowCommentInput(false);
    setShowTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  // Extract page-specific highlights
  const pageHighlights = highlights.filter(h => h.documentId === document.id && h.pageNumber === activePageNumber);

  return (
    <div className="flex-1 flex flex-col bg-[#E5E7EB] border-r border-slate-200 overflow-hidden relative h-full" id="center-panel-root">
      
      {/* Desk Titlebar navigation */}
      <div className="h-12 bg-[#FAFAFA] border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 min-w-0 font-sans">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          <h2 className="text-xs font-bold text-slate-900 truncate animate-none" title={document.title}>
            {document.title}
          </h2>
          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono shrink-0">
            Page {activePageNumber} of {document.totalPages}
          </span>
        </div>

        {/* Quick Reader Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom selectors */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
            <button
              onClick={() => setZoomLevel(prev => Math.max(75, prev - 10))}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              title="Zoom out cursor"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-semibold text-slate-700 w-8 text-center select-none">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              title="Zoom in cursor"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page turning controls */}
          <div className="flex items-center gap-1 font-sans">
            <button
              onClick={() => handlePageNavigation('prev')}
              disabled={activePageNumber === 1}
              className={`p-1 rounded cursor-pointer transition-all ${
                activePageNumber === 1
                  ? "text-slate-400 cursor-not-allowed bg-transparent"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title="Prev page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-700 select-none">
              {activePageNumber} / {document.totalPages}
            </span>
            <button
              onClick={() => handlePageNavigation('next')}
              disabled={activePageNumber === document.totalPages}
              className={`p-1 rounded cursor-pointer transition-all ${
                activePageNumber === document.totalPages
                  ? "text-slate-400 cursor-not-allowed bg-transparent"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader Paper Layout - Single Page view container */}
      <div 
        ref={scrollerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col items-center select-text h-full relative box-border" 
        id="reader-paper-scroller"
      >
        <div 
          className="w-full max-w-[1200px] flex flex-col items-center relative gap-8 box-border"
        >
          {(() => {
            const pg = document.pages.find(p => p.pageNumber === activePageNumber) || document.pages[0];
            if (!pg) return null;
            const pageHighlights = highlights.filter(h => h.documentId === document.id && h.pageNumber === pg.pageNumber);

            return (
              <div
                key={pg.pageNumber}
                onMouseUp={(e) => handleMouseUp(e, pg.pageNumber)}
                className="w-full max-w-full box-border bg-white border border-slate-200 rounded-xl p-6 min-h-[820px] relative transition-all duration-150 flex flex-col justify-between shadow-xl shadow-slate-300/30"
              >
                {/* Document Header details */}
                  <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between shrink-0 select-none">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-indigo-500 font-bold">
                      {document.fileType === 'image' ? 'Image Scan Layer' : `Visual Document Page ${pg.pageNumber} of ${document.totalPages}`}
                    </span>
                    <span className="text-[9px] bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">
                      {document.fileType}
                    </span>
                  </div>

                  {/* Core Visual Page Area with Text Decoupling */}
                  <div className="flex-1 relative min-h-[600px] mb-4 overflow-hidden rounded-lg bg-[#E5E7EB] border border-slate-200 w-full max-w-full box-border shadow-inner">
                    {document.fileData && document.fileType === 'pdf' ? (
                      <div className="relative w-full max-w-full h-full min-h-[600px] box-border">
                        {pdfError || pdfjsLoadError ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-center p-6 border border-rose-200 rounded">
                            <AlertCircle className="w-8 h-8 text-rose-500 mb-2 animate-pulse" />
                            <h3 className="text-sm font-bold text-rose-700 font-mono uppercase tracking-wider">Engine Loading Exception</h3>
                            <p className="text-xs text-slate-600 max-w-sm mt-1 leading-relaxed">
                              {pdfError || pdfjsLoadError}
                            </p>
                          </div>
                        ) : pdfLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-center p-6">
                            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                              Parsing visual manuscript plates...
                            </span>
                          </div>
                        ) : pdfDoc ? (
                          <div className="relative w-full max-w-full box-border min-h-[600px] flex items-center justify-center">
                            <VisualPdfPage 
                              pdfDoc={pdfDoc}
                              pageNumber={pg.pageNumber}
                              zoomLevel={zoomLevel}
                            />
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-center p-3">
                            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : document.fileData && document.fileType === 'image' ? (
                      <div className="relative w-full h-full min-h-[600px] flex items-center justify-center bg-slate-100 p-2 box-border">
                        <img
                          src={document.fileData}
                          className="max-h-[580px] max-w-full object-contain pointer-events-none rounded shadow-sm"
                          alt={`Visual SCAN Page ${pg.pageNumber}`}
                          referrerPolicy="no-referrer"
                        />
                        {/* Selectable text overlay layer on top of image scan */}
                        <div className="absolute inset-0 z-10 select-text text-transparent pointer-events-auto bg-transparent whitespace-pre-wrap p-10 font-serif leading-relaxed text-[15px] text-justify tracking-wide overflow-auto selection:bg-indigo-300/30 selection:text-transparent">
                          {pg.rawText}
                        </div>
                      </div>
                    ) : (
                      /* High Fidelity Parchment Styled simulated original manuscript for pre-seeded library items */
                      <div className="relative w-full h-full min-h-[600px] p-8 md:p-12 bg-[#FCFAF2] text-[#2C241E] flex flex-col justify-between select-text font-serif shadow-inner border border-[#E8DFC8]/40 rounded-lg box-border">
                        <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[11px] font-sans text-[#7D6B58] uppercase tracking-wider select-none border-b border-[#E8DFC8]/30 pb-2">
                          <span className="font-semibold text-indigo-900/50">Manuscript Archive Record</span>
                          <span className="font-mono text-[#7D6B58]/60">PAGE {pg.pageNumber}</span>
                        </div>
                        
                        <div className="my-auto py-4 select-text font-serif leading-relaxed text-sm md:text-base text-justify text-[#221B15] selection:bg-amber-200/80 selection:text-[#110D0A]">
                          {pg.rawText}
                        </div>

                        <div className="absolute bottom-4 left-6 right-6 border-t border-[#E8DFC8]/30 pt-2 text-[10px] font-serif italic text-[#7D6B58] text-center select-none">
                          Chrono-Core Historical Library • Item Index #{document.id}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Page Footer */}
                  <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-[10px] text-slate-500 shrink-0 select-none">
                    <span className="font-mono">BIBLIOGRAF CORP © 2026</span>
                    <span className="font-semibold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                      PAGE {pg.pageNumber}
                    </span>
                  </div>

                  {/* Sub-layout Key Terms Concept Row nested within page sheet */}
                  {pg.keyTerms && pg.keyTerms.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 font-sans select-none">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 font-mono">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>Extracted Page Concepts (Click to Query)</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {pg.keyTerms.map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSendToSearch(term)}
                            className="px-2 py-0.5 bg-white text-indigo-600 hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-sm font-sans"
                            title={`Run global search index lookup for "${term}"`}
                          >
                            <Search className="w-2.5 h-2.5 text-indigo-500" />
                            <span>{term}</span>
                          </button>
                        ))}
                      </div>
                      {pg.summary && (
                        <p className="text-[10px] text-slate-600 italic mt-2.5 border-t border-slate-100 pt-2 leading-snug">
                          <span className="font-bold uppercase text-[8px] text-slate-500 mr-1.5 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono">Page Thesis:</span>
                          "{pg.summary}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Highlights under-page list */}
                  {pageHighlights.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 select-none font-sans">
                      <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1 font-mono">
                        <Highlighter className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Surgical Highlights ({pageHighlights.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {pageHighlights.map(hl => (
                          <div key={hl.id} className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded shadow-sm flex justify-between gap-4">
                            <div className="space-y-1">
                              <p className="italic font-serif text-slate-800 border-l-2 border-indigo-400 pl-2 leading-relaxed">
                                "{hl.text}"
                              </p>
                              {hl.comment && (
                                <p className="font-mono text-[10px] text-indigo-700 mt-1">
                                  ↳ Note: {hl.comment}
                                </p>
                              )}
                            </div>
                            <span className="text-[8px] text-slate-500 self-start shrink-0 font-mono">
                              {hl.createdAt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
          })()}
        </div>
      </div>

      {/* Floating Action Trigger context menu */}
      {showTooltip && (
        <div
          id="selection-tooltip-dialog"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          className="absolute z-40 bg-white backdrop-blur-md text-slate-800 rounded-lg shadow-2xl px-2 py-1.5 flex items-center gap-1 tracking-tight select-none border border-slate-200 dynamic-fade-in"
        >
          {!showCommentInput ? (
            <>
              <button
                onClick={triggerSearch}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-slate-700 transition-colors cursor-pointer font-sans"
                title="Populate search on Right panel"
              >
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                <span>Query All</span>
              </button>

              <div className="w-px h-5 bg-slate-200 animate-none"></div>

              <button
                onClick={triggerSemanticAnalysis}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-indigo-700 transition-colors cursor-pointer font-sans"
                title="Synthesize term cross-reference contextually with Gemini AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                <span>AI Synthesis</span>
              </button>

              <div className="w-px h-5 bg-slate-200 animate-none"></div>

              <button
                onClick={() => setShowCommentInput(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-amber-600 transition-colors cursor-pointer font-sans"
                title="Store yellow annotation note"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                <span>Annotate</span>
              </button>
            </>
          ) : (
            <form onSubmit={executeAddHighlight} className="p-1 flex flex-col gap-2 w-52 text-xs font-sans">
              <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-200">
                <span className="font-bold text-[10px] text-slate-500 uppercase">Save Highlight</span>
                
                {/* Choose color */}
                <div className="flex items-center gap-1">
                  {['yellow', 'cyan', 'rose'].map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setColorKey(key);
                      }}
                      className={`w-3.5 h-3.5 rounded-full cursor-pointer ${
                        key === 'yellow' ? 'bg-yellow-400' :
                        key === 'cyan' ? 'bg-cyan-400' : 'bg-rose-400'
                      } ${colorKey === key ? 'ring-2 ring-slate-400 scale-110' : ''}`}
                    />
                  ))}
                </div>
              </div>

              <input
                type="text"
                autoFocus
                placeholder="Annotation text/comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="w-full p-1 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans"
              />

              <div className="flex items-center justify-end gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowCommentInput(false)}
                  className="px-2 py-0.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Little arrow indicator pointing to selected text */}
          <div className="absolute top-full left-1/2 -ml-1 border-4 border-solid border-transparent border-t-white z-40"></div>
        </div>
      )}

    </div>
  );
}
