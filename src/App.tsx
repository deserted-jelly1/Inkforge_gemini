/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OneNoteRibbon, SaveStatus } from './components/OneNoteRibbon';
import { OneNoteSidebar } from './components/OneNoteSidebar';
import { OneNoteCanvas } from './components/OneNoteCanvas';
import { DeveloperArea } from './components/DeveloperArea';
import { HandwritingLab } from './components/HandwritingLab/HandwritingLab';
import { HistoryTimeline } from './components/HistoryTimeline';
import {
  NotebookData,
  SectionData,
  PageData,
  ToolType,
  BackgroundPattern,
  TextNoteContainer,
} from './types/inkforge';
import {
  PageHistoryRegistry,
  ClearInkCommand,
  AddTextNoteCommand,
} from './utils/historyManager';
import {
  loadActiveNotebook,
  saveActiveNotebook,
  seedDefaultNotebook,
  validateAndParseBackup,
  createBackupEnvelope,
} from './utils/storage';
import { exportPageAsPNG, exportPageAsPDF } from './utils/exportPage';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'draw' | 'home' | 'view' | 'lab' | 'dev'>('draw');

  // Drawing tool states
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#0f172a');
  const [baseWidth, setBaseWidth] = useState<number>(2.2);
  const [highlighterWidth, setHighlighterWidth] = useState<number>(16.0);
  const [eraserRadius, setEraserRadius] = useState<number>(20);

  // Sidebar and History Drawer state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Persistence and Error States
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Monotonic save sequence tracking to guarantee older in-flight saves never mark newer pending edits as saved
  const saveSequenceRef = useRef<number>(0);
  const lastSavedSequenceRef = useRef<number>(0);

  // Session key to force fresh canvas mount and transient state reset on document restore
  const [sessionKey, setSessionKey] = useState<number>(0);

  // Page History Registry
  const historyRegistryRef = useRef<PageHistoryRegistry>(new PageHistoryRegistry());
  const [, setHistoryRenderTick] = useState<number>(0);

  // Newly created note to focus
  const [newNoteFocusId, setNewNoteFocusId] = useState<string | null>(null);

  // Notebook state (initialized with empty dummy until load completes)
  const [notebook, setNotebook] = useState<NotebookData>(() => seedDefaultNotebook());

  // Debounced Autosave Timer Ref
  const autosaveTimeoutRef = useRef<any>(null);
  const pendingNotebookRef = useRef<NotebookData>(notebook);

  // 1. Initial Load: Explicitly separate 'found', 'not_found', and 'error'
  const performInitialLoad = useCallback(() => {
    setLoadError(null);
    setIsLoaded(false);

    loadActiveNotebook()
      .then((result) => {
        if (result.status === 'found') {
          setNotebook(result.notebook);
          pendingNotebookRef.current = result.notebook;
          setSaveStatus('idle');
          setIsLoaded(true);
        } else if (result.status === 'not_found') {
          // No notebook exists yet: seed default notebook
          const seeded = seedDefaultNotebook();
          setNotebook(seeded);
          pendingNotebookRef.current = seeded;
          const seq = ++saveSequenceRef.current;
          saveActiveNotebook(seeded)
            .then(() => {
              if (seq >= lastSavedSequenceRef.current) {
                lastSavedSequenceRef.current = seq;
                setSaveStatus('idle');
              }
            })
            .catch((err) => {
              console.error('Failed saving seeded notebook:', err);
              setSaveStatus('error');
            });
          setIsLoaded(true);
        } else if (result.status === 'error') {
          // Read error: NEVER seed or overwrite storage after a read error!
          setLoadError(result.error);
          setIsLoaded(true);
        }
      })
      .catch((err) => {
        setLoadError(err?.message || 'Failed initializing storage.');
        setIsLoaded(true);
      });
  }, []);

  useEffect(() => {
    performInitialLoad();
  }, [performInitialLoad]);

  // 2. Debounced Autosave with Sequence Numbering
  const triggerAutosave = useCallback((updatedNotebook: NotebookData) => {
    pendingNotebookRef.current = updatedNotebook;
    const currentSeq = ++saveSequenceRef.current;
    setSaveStatus('saving');

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveActiveNotebook(pendingNotebookRef.current)
        .then(() => {
          // Only mark saved if no newer edits occurred while this save was executing
          if (currentSeq >= saveSequenceRef.current) {
            lastSavedSequenceRef.current = currentSeq;
            setSaveStatus('idle');
          }
        })
        .catch((err) => {
          console.error('Autosave failed:', err);
          setSaveStatus('error');
        });
    }, 600);
  }, []);

  const handleRetrySave = () => {
    const currentSeq = ++saveSequenceRef.current;
    setSaveStatus('saving');
    saveActiveNotebook(pendingNotebookRef.current)
      .then(() => {
        if (currentSeq >= saveSequenceRef.current) {
          lastSavedSequenceRef.current = currentSeq;
          setSaveStatus('idle');
        }
      })
      .catch(() => setSaveStatus('error'));
  };

  // Find active Section and Page by stable IDs
  const activeSection =
    notebook.sections.find((s) => s.id === notebook.activeSectionId) || notebook.sections[0];
  const activePage =
    activeSection.pages.find((p) => p.id === notebook.activePageId) || activeSection.pages[0];

  // Derive paper pattern directly from active page instead of duplicating in global state
  const backgroundPattern: BackgroundPattern = activePage.backgroundPattern || 'lined';

  // Subscribe to current page's history manager
  const currentHistoryManager = historyRegistryRef.current.getHistoryManager(activePage.id);

  useEffect(() => {
    return currentHistoryManager.subscribe(() => {
      setHistoryRenderTick((t) => t + 1);
    });
  }, [currentHistoryManager]);

  // Update Page callback (page-scoped, purely transforms the active page)
  const handleUpdateCurrentPage = useCallback(
    (transform: (prevPage: PageData) => PageData) => {
      setNotebook((prevNotebook) => {
        const targetSectionId = prevNotebook.activeSectionId;
        const targetPageId = prevNotebook.activePageId;

        const updatedSections = prevNotebook.sections.map((sec) => {
          if (sec.id !== targetSectionId) return sec;
          const updatedPages = sec.pages.map((p) => {
            if (p.id !== targetPageId) return p;
            return transform(p);
          });
          return { ...sec, pages: updatedPages };
        });

        const newNotebook: NotebookData = {
          ...prevNotebook,
          sections: updatedSections,
          updatedAt: Date.now(),
        };

        triggerAutosave(newNotebook);
        return newNotebook;
      });
    },
    [triggerAutosave]
  );

  // Section and Page Navigation
  const handleSelectSection = (sectionId: string) => {
    const sec = notebook.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const targetPageId = sec.pages[0]?.id || '';

    setNotebook((prev) => {
      const updated = {
        ...prev,
        activeSectionId: sectionId,
        activePageId: targetPageId,
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleSelectPage = (sectionId: string, pageId: string) => {
    setNotebook((prev) => {
      const updated = {
        ...prev,
        activeSectionId: sectionId,
        activePageId: pageId,
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleAddSection = () => {
    const colors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#4f46e5'];
    const newColor = colors[notebook.sections.length % colors.length];
    const newSecId = `sec_${Date.now()}`;
    const newPageId = `page_${Date.now()}`;

    const newSection: SectionData = {
      id: newSecId,
      title: `Section ${notebook.sections.length + 1}`,
      color: newColor,
      pages: [
        {
          id: newPageId,
          title: 'Untitled page',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          backgroundPattern: 'lined',
          gridSpacing: 28,
          viewport: { zoom: 1.0, panX: 0, panY: 0 },
          strokes: [],
          textNotes: [],
        },
      ],
    };

    setNotebook((prev) => {
      const updated = {
        ...prev,
        sections: [...prev.sections, newSection],
        activeSectionId: newSecId,
        activePageId: newPageId,
        updatedAt: Date.now(),
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleRenameSection = (sectionId: string, newTitle: string) => {
    setNotebook((prev) => {
      const updatedSections = prev.sections.map((s) =>
        s.id === sectionId ? { ...s, title: newTitle } : s
      );
      const updated = { ...prev, sections: updatedSections, updatedAt: Date.now() };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleChangeSectionColor = (sectionId: string, color: string) => {
    setNotebook((prev) => {
      const updatedSections = prev.sections.map((s) =>
        s.id === sectionId ? { ...s, color } : s
      );
      const updated = { ...prev, sections: updatedSections, updatedAt: Date.now() };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (notebook.sections.length <= 1) return;
    setNotebook((prev) => {
      const remainingSections = prev.sections.filter((s) => s.id !== sectionId);
      let newActiveSectionId = prev.activeSectionId;
      let newActivePageId = prev.activePageId;

      if (sectionId === prev.activeSectionId) {
        newActiveSectionId = remainingSections[0].id;
        newActivePageId = remainingSections[0].pages[0]?.id || '';
      }

      const updated = {
        ...prev,
        sections: remainingSections,
        activeSectionId: newActiveSectionId,
        activePageId: newActivePageId,
        updatedAt: Date.now(),
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleAddPage = (sectionId: string) => {
    const newPageId = `page_${Date.now()}`;
    const newPage: PageData = {
      id: newPageId,
      title: 'Untitled page',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      backgroundPattern: 'lined',
      gridSpacing: 28,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      strokes: [],
      textNotes: [],
    };

    setNotebook((prev) => {
      const updatedSections = prev.sections.map((s) =>
        s.id === sectionId ? { ...s, pages: [...s.pages, newPage] } : s
      );
      const updated = {
        ...prev,
        sections: updatedSections,
        activeSectionId: sectionId,
        activePageId: newPageId,
        updatedAt: Date.now(),
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleDuplicatePage = (sectionId: string, pageId: string) => {
    const sec = notebook.sections.find((s) => s.id === sectionId);
    const sourcePage = sec?.pages.find((p) => p.id === pageId);
    if (!sourcePage) return;

    const newPageId = `page_${Date.now()}`;
    const duplicatedPage: PageData = {
      ...sourcePage,
      id: newPageId,
      title: `${sourcePage.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      strokes: sourcePage.strokes.map((s) => ({ ...s, id: `stroke_${Date.now()}_${Math.random()}` })),
      textNotes: sourcePage.textNotes?.map((n) => ({ ...n, id: `note_${Date.now()}_${Math.random()}` })),
    };

    setNotebook((prev) => {
      const updatedSections = prev.sections.map((s) =>
        s.id === sectionId ? { ...s, pages: [...s.pages, duplicatedPage] } : s
      );
      const updated = {
        ...prev,
        sections: updatedSections,
        activeSectionId: sectionId,
        activePageId: newPageId,
        updatedAt: Date.now(),
      };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleDeletePage = (sectionId: string, pageId: string) => {
    const sec = notebook.sections.find((s) => s.id === sectionId);
    if (!sec || sec.pages.length <= 1) return;

    setNotebook((prev) => {
      const updatedSections = prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, pages: s.pages.filter((p) => p.id !== pageId) };
      });

      let newActivePageId = prev.activePageId;
      if (prev.activePageId === pageId) {
        const remainingPages = updatedSections.find((s) => s.id === sectionId)!.pages;
        newActivePageId = remainingPages[0].id;
      }

      const updated = {
        ...prev,
        sections: updatedSections,
        activePageId: newActivePageId,
        updatedAt: Date.now(),
      };
      triggerAutosave(updated);
      return updated;
    });

    historyRegistryRef.current.removePage(pageId);
  };

  const handleRenameNotebook = (newTitle: string) => {
    setNotebook((prev) => {
      const updated = { ...prev, title: newTitle, updatedAt: Date.now() };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleClearInk = () => {
    if (activePage.strokes.length === 0) return;
    const prior = [...activePage.strokes];
    const cmd = new ClearInkCommand(activePage.id, prior);
    currentHistoryManager.executeCommand(cmd, handleUpdateCurrentPage);
  };

  const handleInsertTextBox = () => {
    const noteId = `note_${Date.now()}`;
    const newNote: TextNoteContainer = {
      id: noteId,
      x: 130,
      y: 220,
      width: 320,
      text: '',
    };
    const cmd = new AddTextNoteCommand(activePage.id, newNote);
    currentHistoryManager.executeCommand(cmd, handleUpdateCurrentPage);
    setNewNoteFocusId(noteId);
    setActiveTool('text');
  };

  const handleExportJSON = () => {
    const envelope = createBackupEnvelope(notebook);
    const jsonBlob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InkForge_Backup_${notebook.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 3. Restore: Clean document-session boundary
  const handleImportJSON = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { notebook: validated, error } = validateAndParseBackup(text);
      if (error || !validated) {
        // Preserve current notebook completely if validation fails
        setImportError(error || 'Failed to parse backup.');
        return;
      }

      // Clean document-session boundary:
      // 1. Cancel pending debounced autosaves
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }

      // 2. Increment save sequence to drop any in-flight requests
      const currentSeq = ++saveSequenceRef.current;

      // 3. Reset all page histories and transient state
      historyRegistryRef.current.resetAll();
      setIsHistoryOpen(false);
      setNewNoteFocusId(null);
      setSessionKey((k) => k + 1);

      // 4. Update notebook state
      setNotebook(validated);
      pendingNotebookRef.current = validated;

      // 5. Save imported document immediately
      setSaveStatus('saving');
      saveActiveNotebook(validated)
        .then(() => {
          if (currentSeq >= saveSequenceRef.current) {
            lastSavedSequenceRef.current = currentSeq;
            setSaveStatus('idle');
          }
        })
        .catch(() => setSaveStatus('error'));
    };
    reader.onerror = () => setImportError('Failed to read file from disk.');
    reader.readAsText(file);
  };

  // Paper background change
  const handleChangePattern = (p: BackgroundPattern) => {
    handleUpdateCurrentPage((prev) => ({
      ...prev,
      backgroundPattern: p,
      updatedAt: Date.now(),
    }));
  };

  // Recoverable Load Error View
  if (loadError) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-50 p-6 text-neutral-800 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h2 className="text-base font-semibold">Storage Read Failure</h2>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            InkForge encountered an error opening your local storage. To protect your notes, the app will not seed or overwrite existing data.
          </p>
          <div className="p-2.5 rounded bg-neutral-100 font-mono text-[11px] text-neutral-700 break-all">
            {loadError}
          </div>
          <button
            onClick={performInitialLoad}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-medium text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Notebook</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-neutral-50 text-neutral-600 font-sans text-xs">
        Loading InkForge Notebook...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[#f8fafc] text-neutral-900 overflow-hidden font-sans antialiased">
      {/* Import / Export Error Banners */}
      {importError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800 z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            onClick={() => setImportError(null)}
            className="p-1 hover:bg-rose-100 rounded text-rose-600"
            aria-label="Dismiss import error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {exportError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800 z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="p-1 hover:bg-amber-100 rounded text-amber-600"
            aria-label="Dismiss export error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Ribbon Bar */}
      <OneNoteRibbon
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        baseWidth={baseWidth}
        setBaseWidth={setBaseWidth}
        highlighterWidth={highlighterWidth}
        setHighlighterWidth={setHighlighterWidth}
        eraserRadius={eraserRadius}
        setEraserRadius={setEraserRadius}
        backgroundPattern={backgroundPattern}
        setBackgroundPattern={handleChangePattern}
        historyManager={currentHistoryManager}
        onUndo={() => currentHistoryManager.undo(handleUpdateCurrentPage)}
        onRedo={() => currentHistoryManager.redo(handleUpdateCurrentPage)}
        onClearInk={handleClearInk}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        isHistoryOpen={isHistoryOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onInsertTextBox={handleInsertTextBox}
        onExportPNG={() => exportPageAsPNG(activePage, notebook.title, setExportError)}
        onExportPDF={() => exportPageAsPDF(activePage, notebook.title, setExportError)}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        saveStatus={saveStatus}
        onRetrySave={handleRetrySave}
      />

      {/* 2. Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <OneNoteSidebar
          notebook={notebook}
          onSelectSection={handleSelectSection}
          onSelectPage={handleSelectPage}
          onAddSection={handleAddSection}
          onRenameSection={handleRenameSection}
          onChangeSectionColor={handleChangeSectionColor}
          onDeleteSection={handleDeleteSection}
          onAddPage={handleAddPage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onRenameNotebook={handleRenameNotebook}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Canvas Surface or Developer Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {(activeTab === 'draw' || activeTab === 'home' || activeTab === 'view') && (
            <OneNoteCanvas
              key={`${activePage.id}_${sessionKey}`}
              page={activePage}
              onUpdatePage={handleUpdateCurrentPage}
              activeTool={activeTool}
              activeColor={activeColor}
              baseWidth={baseWidth}
              highlighterWidth={highlighterWidth}
              eraserRadius={eraserRadius}
              backgroundPattern={backgroundPattern}
              historyManager={currentHistoryManager}
              newNoteFocusId={newNoteFocusId}
              onClearNewNoteFocus={() => setNewNoteFocusId(null)}
            />
          )}

          {activeTab === 'lab' && <HandwritingLab />}

          {activeTab === 'dev' && <DeveloperArea />}
        </div>

        {/* Page-Scoped History Timeline Drawer */}
        <HistoryTimeline
          historyManager={currentHistoryManager}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onApplyToPage={handleUpdateCurrentPage}
        />
      </div>
    </div>
  );
}
