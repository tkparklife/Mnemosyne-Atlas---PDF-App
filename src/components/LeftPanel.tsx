import React, { useState, useRef, useEffect } from "react";
import {
  FolderPlus,
  BookOpen,
  Trash2,
  UploadCloud,
  Tag,
  Layers,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Star,
  Cloud,
} from "lucide-react";
import { PDFDocument, Collection } from "../types";

interface LeftPanelProps {
  documents: PDFDocument[];
  collections: Collection[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onUploadComplete: (newDoc: PDFDocument) => void;
  onAddCollection: (name: string, description: string, color: string) => void;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onDeleteCollection: (id: string) => void;
  onUpdateDocCollections?: (docId: string, collectionIds: string[]) => void;
}

export default function LeftPanel({
  documents,
  collections,
  selectedDocId,
  onSelectDoc,
  onDeleteDoc,
  onUploadComplete,
  onAddCollection,
  selectedCollectionId,
  onSelectCollection,
  onDeleteCollection,
  onUpdateDocCollections,
}: LeftPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<{
    status: "idle" | "uploading" | "error" | "success";
    filename?: string;
    step?: string;
    error?: string;
  }>({ status: "idle" });

  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("indigo");
  const [showColModal, setShowColModal] = useState(false);
  const [docColMenuId, setDocColMenuId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<
    string | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Drive Integration State
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);

  useEffect(() => {
    const loadScript = (
      src: string,
      isLoaded: () => boolean,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (isLoaded()) {
          resolve();
          return;
        }

        const existingScript = document.querySelector(
          `script[src="${src}"]`,
        ) as HTMLScriptElement;
        if (existingScript) {
          // If the script exists but isn't fully loaded (React Strict Mode double-render)
          const check = setInterval(() => {
            if (isLoaded()) {
              clearInterval(check);
              resolve();
            }
          }, 100);
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
      });
    };

    const initGoogleApi = async () => {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

        if (!clientId || !apiKey) {
          console.error(
            `Missing Google Cloud credentials: ${!clientId ? "VITE_GOOGLE_CLIENT_ID is missing." : ""} ${!apiKey ? "VITE_GOOGLE_API_KEY is missing." : ""}`,
          );
        }

        // Load both scripts explicitly
        await Promise.all([
          loadScript(
            "https://apis.google.com/js/api.js",
            () => !!window.gapi && !!window.gapi.load,
          ),
          loadScript(
            "https://accounts.google.com/gsi/client",
            () => !!window.google?.accounts?.oauth2,
          ),
        ]);

        // Load the picker library inside GAPI
        await new Promise<void>((resolve, reject) => {
          try {
            window.gapi.load("picker", {
              callback: resolve,
              onerror: () => reject(new Error("Failed to load picker API")),
            });
          } catch (e) {
            reject(e);
          }
        });
        setGapiLoaded(true);
        setGisLoaded(true);
      } catch (err: any) {
        console.error("Google Integration Initialization Failed:", err);
      }
    };

    initGoogleApi();
  }, []);

  const handleDriveImport = () => {
    if (!gapiLoaded || !gisLoaded) {
      alert(
        "Google Drive APIs are not fully loaded. Please wait a moment and try again.",
      );
      return;
    }

    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        alert("Client ID is missing. Check console for details.");
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            createPicker(tokenResponse.access_token);
          } else if (tokenResponse?.error) {
            alert(`Google OAuth Error: ${tokenResponse.error}`);
          }
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      alert(`Token Request Error: ${err.message || err}`);
    }
  };

  const createPicker = (accessToken: string) => {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      window.gapi.load("picker", () => {
        const view = new window.google.picker.DocsView(
          window.google.picker.ViewId.PDFS,
        );

        const picker = new window.google.picker.PickerBuilder()
          .setDeveloperKey(apiKey || "")
          .setAppId(clientId || "")
          .setOAuthToken(accessToken)
          .addView(view)
          .setCallback((data: any) => pickerCallback(data, accessToken))
          .build();

        picker.setVisible(true);
      });
    } catch (err: any) {
      alert(`Picker creation error: ${err.message || err}`);
    }
  };

  const pickerCallback = async (data: any, accessToken: string) => {
    if (
      data[window.google.picker.Response.ACTION] ===
      window.google.picker.Action.PICKED
    ) {
      const doc = data[window.google.picker.Response.DOCUMENTS][0];
      const fileId = doc[window.google.picker.Document.ID];
      const fileName = doc[window.google.picker.Document.NAME];

      setUploadState({
        status: "uploading",
        filename: fileName,
        step: "Downloading from Google Drive...",
      });

      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        if (!res.ok)
          throw new Error("Failed to download file from Google Drive");

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Pass it directly to the local viewer as an object URL
        const driveDoc: PDFDocument = {
          id: fileId,
          title: fileName,
          fileType: "pdf",
          fileData: blobUrl,
          uploadDate: new Date().toISOString(),
          totalPages: 1,
          // We supply a minimal page object so CenterPanel doesn't crash
          pages: [{ pageNumber: 1, rawText: "" }],
          summary: "Imported locally from Google Drive.",
          entities: [],
        };

        onUploadComplete(driveDoc);
        setUploadState({ status: "idle" });
      } catch (err: any) {
        console.error("Picker error:", err);
        setUploadState({
          status: "error",
          error: err.message || "Google Drive file fetch failed.",
        });
      }
    }
  };

  // Styling maps for light theme glassmorphic design
  const colorMap: Record<string, string> = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };

  const ringMap: Record<string, string> = {
    rose: "ring-rose-400 text-rose-800 border-rose-300",
    amber: "ring-amber-400 text-amber-800 border-amber-300",
    indigo: "ring-indigo-400 text-indigo-800 border-indigo-300",
    emerald: "ring-emerald-400 text-emerald-800 border-emerald-300",
    sky: "ring-sky-400 text-sky-800 border-sky-300",
    violet: "ring-violet-400 text-violet-800 border-violet-300",
  };

  // Convert File to Base64 helper
  const processUpload = async (file: File) => {
    if (!file) return;

    setUploadState({
      status: "uploading",
      filename: file.name,
      step: "Reading file bytes...",
    });

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".txt");

    if (!isPdf && !isImage && !isText) {
      setUploadState({
        status: "error",
        error:
          "Invalid format. Load standard PDFs, PNG/JPEG images, or TXT manuscripts.",
      });
      return;
    }

    try {
      const reader = new FileReader();

      const fileLoadedPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });

      reader.readAsDataURL(file);
      const base64Data = await fileLoadedPromise;

      // Stage steps for high fidelity feedback
      const steps = [
        "Sending document payload to knowledge indexer...",
        "Calling server-side Gemini 3.5 OCR scanner...",
        "Parsing rich structural layout & text segments...",
        "Generating philosophical summaries & entity terms...",
        "Compiling cross-document search vectors...",
      ];

      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < steps.length - 1) {
          stepIdx++;
          setUploadState((prev) => ({ ...prev, step: steps[stepIdx] }));
        }
      }, 1500);

      const mimeType =
        file.type ||
        (isPdf ? "application/pdf" : isText ? "text/plain" : "image/png");
      const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          fileData: base64Data,
          mimeType,
          fileSize: sizeStr,
          fileType: isPdf ? "pdf" : isImage ? "image" : "text",
          collectionIds: selectedCollectionId ? [selectedCollectionId] : [],
        }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.details || errJson.error || "Uploader error");
      }

      const parsedDoc: PDFDocument = await res.json();

      setUploadState({
        status: "success",
        filename: file.name,
      });

      onUploadComplete(parsedDoc);

      // Reset feedback status slowly
      setTimeout(() => {
        setUploadState({ status: "idle" });
      }, 3000);
    } catch (e: any) {
      console.error("Upload failure:", e);
      setUploadState({
        status: "error",
        error: e.message || "Unknown indexer ingestion exception",
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragOver(true);
    } else if (e.type === "dragleave") {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
    }
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onAddCollection(newColName, newColDesc, newColColor);
    setNewColName("");
    setNewColDesc("");
    setNewColColor("indigo");
    setShowColModal(false);
  };

  // Filter docs
  const filteredDocuments = selectedCollectionId
    ? documents.filter((d) => d.collections.includes(selectedCollectionId))
    : documents;

  return (
    <div
      className="w-80 border-r border-slate-200 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800"
      id="left-panel-root"
    >
      {/* Brand & Stats */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            PDF Knowledge Library
          </h1>
        </div>
        <p className="text-[11px] text-slate-500">
          Library contains {documents.length} document
          {documents.length !== 1 && "s"} ({collections.length} collections)
        </p>
      </div>

      {/* Upload Zone */}
      <div className="p-4 shrink-0 bg-white border-b border-slate-200">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragOver
              ? "bg-indigo-50 border-indigo-400"
              : "bg-slate-50 border-slate-300 hover:bg-slate-100"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.png,.jpeg,.jpg,.txt"
            className="hidden"
          />

          {uploadState.status === "idle" && (
            <>
              <UploadCloud className="w-6 h-6 text-slate-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-700">
                Drag or Click to Upload
              </span>
              <span className="text-[10px] text-slate-500 mt-1">
                PDF, TXT, or JPEG/PNG
              </span>
            </>
          )}

          {uploadState.status === "uploading" && (
            <div className="flex flex-col items-center justify-center w-full text-center">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin mb-1.5" />
              <span className="text-xs font-semibold text-indigo-700">
                Indexing Archive...
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-1 w-full truncate px-2">
                {uploadState.step}
              </span>
            </div>
          )}

          {uploadState.status === "success" && (
            <div className="flex flex-col items-center justify-center text-center">
              <Check className="w-5 h-5 text-emerald-600 mb-1.5 bg-emerald-50 rounded-full p-1 border border-emerald-200" />
              <span className="text-xs font-semibold text-emerald-700">
                Successfully Indexed!
              </span>
              <span className="text-[10px] text-slate-500 truncate w-full px-2 mt-1">
                {uploadState.filename}
              </span>
            </div>
          )}

          {uploadState.status === "error" && (
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-5 h-5 text-rose-500 mb-1.5" />
              <span className="text-xs font-semibold text-rose-700">
                Pipeline Ingestion Failed
              </span>
              <span className="text-[10px] text-rose-500 mt-1 px-1 line-clamp-2">
                {uploadState.error}
              </span>
            </div>
          )}
        </div>

        {/* Google Drive Import Button */}
        <button
          onClick={handleDriveImport}
          disabled={!gapiLoaded || !gisLoaded}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Cloud className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">
            Import from Google Drive
          </span>
        </button>
      </div>

      {/* Collections Section */}
      <div className="p-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Collections</span>
          </div>
          <button
            onClick={() => setShowColModal(true)}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <FolderPlus className="w-3 h-3" />
            <span>Create</span>
          </button>
        </div>

        {/* Collections Badges List */}
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          <button
            onClick={() => onSelectCollection(null)}
            className={`px-2 py-1 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${
              selectedCollectionId === null
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            All Docs
          </button>

          {collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            const isDeleting = deletingCollectionId === col.id;
            const styleClass =
              colorMap[col.color] ||
              "bg-indigo-50 text-indigo-700 border-indigo-200";
            return (
              <div
                key={col.id}
                title={col.description}
                className={`group px-2 py-1 text-xs font-semibold rounded-md border cursor-pointer transition-colors flex items-center justify-between gap-2 shadow-sm ${
                  isSelected
                    ? `ring-1 ring-offset-1 font-bold ${ringMap[col.color]} ${styleClass}`
                    : `${styleClass} hover:opacity-85`
                }`}
                onClick={() => {
                  if (deletingCollectionId) setDeletingCollectionId(null);
                  onSelectCollection(col.id);
                }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Tag className="w-2.5 h-2.5 opacity-60 shrink-0" />
                  <span className="truncate">
                    {isDeleting ? "Delete?" : col.name}
                  </span>
                </div>
                {isDeleting ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCollection(col.id);
                        setDeletingCollectionId(null);
                      }}
                      className="text-white bg-rose-600 hover:bg-rose-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition-colors shadow-sm"
                    >
                      Yes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCollectionId(null);
                      }}
                      className="text-slate-600 bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingCollectionId(col.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity focus:outline-none shrink-0"
                    title="Delete collection"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Library Scrollable Document List */}
      <div
        className="flex-1 overflow-y-auto p-3"
        id="library-documents-scroller"
      >
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wildest mb-2 px-1">
          {selectedCollectionId ? "Collection Items" : "All Library Archives"}
        </h3>

        {filteredDocuments.length === 0 ? (
          <div className="p-6 text-center bg-white border border-slate-200 rounded-lg shadow-sm">
            <Layers className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs text-slate-800 font-semibold">No documents</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
              {selectedCollectionId
                ? "This collection is empty. Drag a file here to add it."
                : "Upload manuscripts or PDFs to begin deep research."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const isActive = selectedDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all relative group ${
                    isActive
                      ? "bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-400"
                      : "bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300 shadow-sm"
                  }`}
                >
                  {/* Title & Actions */}
                  <div className="flex justify-between items-start gap-1 pr-12 relative">
                    <h4
                      className={`text-xs font-semibold truncate leading-tight ${
                        isActive ? "text-indigo-900" : "text-slate-800"
                      }`}
                    >
                      {doc.title}
                    </h4>

                    <div className="absolute -top-0.5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocColMenuId(
                            docColMenuId === doc.id ? null : doc.id,
                          );
                        }}
                        className="text-slate-400 hover:text-indigo-600 focus:outline-none p-0.5 rounded cursor-pointer"
                        title="Manage collections"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 focus:outline-none p-0.5 rounded cursor-pointer animate-none"
                        title="Delete archived draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Manage Collections Dropdown popover */}
                    {docColMenuId === doc.id && (
                      <div
                        className="absolute top-6 right-0 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-30 p-2 font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 border-b border-slate-200 pb-1 flex justify-between items-center">
                          <span>Set Collections</span>
                          <button
                            onClick={() => setDocColMenuId(null)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            ×
                          </button>
                        </div>
                        <div className="space-y-0.5 max-h-32 overflow-y-auto mb-2 text-slate-700">
                          {collections.length === 0 && (
                            <div className="text-[10px] text-slate-500 italic px-1 py-1">
                              No collections available.
                            </div>
                          )}
                          {collections.map((c) => {
                            const inCol = doc.collections.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className="flex items-center gap-2 w-full px-1.5 py-1 text-xs hover:bg-slate-100 rounded cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={inCol}
                                  onChange={() => {
                                    if (!onUpdateDocCollections) return;
                                    const nextCols = inCol
                                      ? doc.collections.filter(
                                          (cid) => cid !== c.id,
                                        )
                                      : [...doc.collections, c.id];
                                    onUpdateDocCollections(doc.id, nextCols);
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-0 bg-white w-3 h-3 cursor-pointer"
                                />
                                <span className="truncate">{c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowColModal(true);
                            setDocColMenuId(null);
                          }}
                          className="w-full text-left px-1.5 py-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3 h-3" /> Create New...
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description Context Line */}
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                    {doc.description ||
                      "No localized document meta summary configured."}
                  </p>

                  {/* Metadata Indicators bar */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[9px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                      {doc.fileSize}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                      {doc.totalPages} pg{doc.totalPages !== 1 && "s"}
                    </span>
                    {doc.ocrApplied ? (
                      <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-0.5">
                        <Check className="w-2 h-2 text-indigo-600" /> GEMINI OCR
                      </span>
                    ) : (
                      <span className="text-[8px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                        TEXT-PDF
                      </span>
                    )}

                    {/* Show Tag badges inside document item */}
                    {doc.collections.map((colId) => {
                      const tag = collections.find((c) => c.id === colId);
                      if (!tag) return null;
                      return (
                        <span
                          key={colId}
                          className={`text-[8px] px-1 rounded-sm border opacity-90 ${colorMap[tag.color] || "bg-slate-100"}`}
                        >
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connection Mode Footer Indicator */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 text-[10px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          <span>Dual Index Engine</span>
        </div>
        <span className="font-mono text-slate-400 text-[9px]">v2.1.0</span>
      </div>

      {/* Creation Tag Modal Dialog popup */}
      {showColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5 dynamic-fade-in animate-scale-up text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>Create New Collection</span>
            </h3>

            <form onSubmit={handleCreateCollection} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Post-Structuralism"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Focusing on text deconstruction models..."
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50 focus:bg-white text-slate-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Theme Hue
                </label>
                <div className="flex items-center gap-2 mt-1 font-medium">
                  {["rose", "amber", "indigo", "emerald", "sky", "violet"].map(
                    (hue) => (
                      <button
                        key={hue}
                        type="button"
                        onClick={() => setNewColColor(hue)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform relative ${
                          hue === "rose"
                            ? "bg-rose-500"
                            : hue === "amber"
                              ? "bg-amber-500"
                              : hue === "indigo"
                                ? "bg-indigo-500"
                                : hue === "emerald"
                                  ? "bg-emerald-500"
                                  : hue === "sky"
                                    ? "bg-sky-500"
                                    : "bg-violet-500"
                        } ${newColColor === hue ? "scale-125 ring-2 ring-offset-2 ring-indigo-400 shadow-sm" : ""}`}
                      />
                    ),
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setShowColModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-md cursor-pointer shadow-sm transition-colors"
                >
                  Save Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
