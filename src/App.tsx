/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OneNoteRibbon } from './components/OneNoteRibbon';
import { OneNoteSidebar } from './components/OneNoteSidebar';
import { OneNoteCanvas } from './components/OneNoteCanvas';
import { ArchitectureViewer } from './components/ArchitectureViewer';
import { CodeExplorer } from './components/CodeExplorer';
import { HistoryTimeline } from './components/HistoryTimeline';
import {
  NotebookData,
  SectionData,
  PageData,
  ToolType,
  BackgroundPattern,
  StrokeData,
  TextNoteContainer,
} from './types/inkforge';
import { evaluateCentripetalCatmullRom } from './utils/spline';
import { HistoryManager, ClearCanvasCommand } from './utils/historyManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<'draw' | 'home' | 'view' | 'architecture' | 'code'>('draw');

  // Drawing tools state
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#0f172a');
  const [baseWidth, setBaseWidth] = useState<number>(2.2);
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern>('lined');

  // Navigation sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Command History Manager
  const [historyManager] = useState<HistoryManager>(() => new HistoryManager(120));
  const [, setHistoryTick] = useState<number>(0);

  useEffect(() => {
    return historyManager.subscribe(() => {
      setHistoryTick((t) => t + 1);
    });
  }, [historyManager]);

  // Initial OneNote Notebook hierarchy (Sections -> Pages)
  const [notebook, setNotebook] = useState<NotebookData>(() => {
    const stroke1Pts = [
      { x: 120, y: 190, pressure: 0.45, tiltX: 0, tiltY: 0, timestamp: 1000 },
      { x: 140, y: 195, pressure: 0.65, tiltX: 0, tiltY: 0, timestamp: 1010 },
      { x: 165, y: 190, pressure: 0.75, tiltX: 0, tiltY: 0, timestamp: 1020 },
      { x: 190, y: 185, pressure: 0.55, tiltX: 0, tiltY: 0, timestamp: 1030 },
      { x: 220, y: 180, pressure: 0.40, tiltX: 0, tiltY: 0, timestamp: 1040 },
    ];

    const stroke2Pts = [
      { x: 170, y: 190, pressure: 0.50, tiltX: 0, tiltY: 0, timestamp: 1050 },
      { x: 168, y: 220, pressure: 0.75, tiltX: 0, tiltY: 0, timestamp: 1060 },
      { x: 165, y: 250, pressure: 0.85, tiltX: 0, tiltY: 0, timestamp: 1070 },
      { x: 160, y: 275, pressure: 0.45, tiltX: 0, tiltY: 0, timestamp: 1080 },
    ];

    const s1: StrokeData = {
      id: 'demo_stroke_1',
      tool: 'pen',
      color: '#1d4ed8',
      baseWidth: 2.2,
      opacity: 1.0,
      points: stroke1Pts,
      smoothedPoints: evaluateCentripetalCatmullRom(stroke1Pts, 8),
      bounds: { minX: 120, minY: 180, maxX: 220, maxY: 195 },
    };

    const s2: StrokeData = {
      id: 'demo_stroke_2',
      tool: 'pen',
      color: '#1d4ed8',
      baseWidth: 2.2,
      opacity: 1.0,
      points: stroke2Pts,
      smoothedPoints: evaluateCentripetalCatmullRom(stroke2Pts, 8),
      bounds: { minX: 160, minY: 190, maxX: 170, maxY: 275 },
    };

    const sampleNote: TextNoteContainer = {
      id: 'note_welcome',
      x: 120,
      y: 310,
      width: 420,
      text: '• Write notes naturally with your stylus or pen\n• Click anywhere on the paper to type\n• Seamlessly organize notes into Sections and Pages',
    };

    const initialPage1: PageData = {
      id: 'p_surface_integrals',
      title: "Calculus III — Surface Integrals & Stokes' Theorem",
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now(),
      backgroundPattern: 'lined',
      gridSpacing: 28,
      strokes: [s1, s2],
      textNotes: [sampleNote],
    };

    const initialPage2: PageData = {
      id: 'p_complex_analysis',
      title: 'Residue Theorem & Contour Integration',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      backgroundPattern: 'grid',
      gridSpacing: 24,
      strokes: [],
      textNotes: [],
    };

    const mathSection: SectionData = {
      id: 'sec_math',
      title: 'Mathematics',
      color: '#0284c7', // Sky Blue
      pages: [initialPage1, initialPage2],
      activePageIndex: 0,
    };

    const quickNotesSection: SectionData = {
      id: 'sec_quick',
      title: 'Quick Notes',
      color: '#7e22ce', // OneNote Purple
      pages: [
        {
          id: 'p_quick_1',
          title: 'Project Ideas & Ink Engine Roadmap',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now(),
          backgroundPattern: 'lined',
          gridSpacing: 28,
          strokes: [],
          textNotes: [
            {
              id: 'note_q1',
              x: 100,
              y: 180,
              width: 350,
              text: 'Investigate One Euro filter coefficients for Wacom Intuos pen tablets.',
            },
          ],
        },
      ],
      activePageIndex: 0,
    };

    const researchSection: SectionData = {
      id: 'sec_research',
      title: 'Research',
      color: '#059669', // Emerald
      pages: [
        {
          id: 'p_res_1',
          title: 'Digital Ink Latency Benchmarks',
          createdAt: Date.now() - 172800000,
          updatedAt: Date.now(),
          backgroundPattern: 'lined',
          gridSpacing: 28,
          strokes: [],
          textNotes: [],
        },
      ],
      activePageIndex: 0,
    };

    return {
      id: 'nb_onenote',
      title: 'My Notebook',
      color: '#7719aa',
      createdAt: Date.now() - 604800000,
      updatedAt: Date.now(),
      sections: [mathSection, quickNotesSection, researchSection],
      activeSectionIndex: 0,
      pages: [initialPage1, initialPage2],
      activePageIndex: 0,
    };
  });

  const currentSection = notebook.sections[notebook.activeSectionIndex] || notebook.sections[0];
  const currentPage = currentSection.pages[currentSection.activePageIndex] || currentSection.pages[0];

  // Update Page callback
  const handleUpdateCurrentPage = (updatedPage: PageData) => {
    setNotebook((prev) => {
      const sections = [...prev.sections];
      const sec = { ...sections[prev.activeSectionIndex] };
      const pages = [...sec.pages];
      pages[sec.activePageIndex] = updatedPage;
      sec.pages = pages;
      sections[prev.activeSectionIndex] = sec;
      return {
        ...prev,
        sections,
        updatedAt: Date.now(),
      };
    });
  };

  // Section / Page Navigation
  const handleSelectSection = (secIndex: number) => {
    setNotebook((prev) => ({
      ...prev,
      activeSectionIndex: secIndex,
    }));
  };

  const handleSelectPage = (pageIndex: number) => {
    setNotebook((prev) => {
      const sections = [...prev.sections];
      const sec = { ...sections[prev.activeSectionIndex] };
      sec.activePageIndex = pageIndex;
      sections[prev.activeSectionIndex] = sec;
      return {
        ...prev,
        sections,
      };
    });
  };

  const handleAddSection = () => {
    const colors = ['#7e22ce', '#0284c7', '#059669', '#d97706', '#dc2626', '#4f46e5'];
    const newColor = colors[notebook.sections.length % colors.length];
    const newSection: SectionData = {
      id: `sec_${Date.now()}`,
      title: `Section ${notebook.sections.length + 1}`,
      color: newColor,
      pages: [
        {
          id: `p_${Date.now()}`,
          title: 'Untitled page',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          backgroundPattern: 'lined',
          gridSpacing: 28,
          strokes: [],
          textNotes: [],
        },
      ],
      activePageIndex: 0,
    };

    setNotebook((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
      activeSectionIndex: prev.sections.length,
      updatedAt: Date.now(),
    }));
  };

  const handleAddPage = () => {
    const newPage: PageData = {
      id: `p_${Date.now()}`,
      title: 'Untitled page',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      backgroundPattern,
      gridSpacing: 28,
      strokes: [],
      textNotes: [],
    };

    setNotebook((prev) => {
      const sections = [...prev.sections];
      const sec = { ...sections[prev.activeSectionIndex] };
      sec.pages = [...sec.pages, newPage];
      sec.activePageIndex = sec.pages.length - 1;
      sections[prev.activeSectionIndex] = sec;
      return {
        ...prev,
        sections,
        updatedAt: Date.now(),
      };
    });
  };

  const handleDeletePage = (pageIndex: number) => {
    if (currentSection.pages.length <= 1) return;
    setNotebook((prev) => {
      const sections = [...prev.sections];
      const sec = { ...sections[prev.activeSectionIndex] };
      sec.pages = sec.pages.filter((_, idx) => idx !== pageIndex);
      if (sec.activePageIndex >= sec.pages.length) {
        sec.activePageIndex = sec.pages.length - 1;
      }
      sections[prev.activeSectionIndex] = sec;
      return {
        ...prev,
        sections,
        updatedAt: Date.now(),
      };
    });
  };

  const handleClearPage = () => {
    if (currentPage.strokes.length === 0) return;
    const priorStrokes = [...currentPage.strokes];

    const clearCmd = new ClearCanvasCommand(
      priorStrokes,
      () => {
        handleUpdateCurrentPage({
          ...currentPage,
          strokes: [],
        });
      },
      (restoredStrokes) => {
        handleUpdateCurrentPage({
          ...currentPage,
          strokes: restoredStrokes,
        });
      }
    );

    historyManager.executeCommand(clearCmd);
  };

  const handleInsertTextBox = () => {
    const newNote: TextNoteContainer = {
      id: `note_${Date.now()}`,
      x: 120,
      y: 220,
      width: 320,
      text: '',
    };
    handleUpdateCurrentPage({
      ...currentPage,
      textNotes: [...(currentPage.textNotes || []), newNote],
    });
    setActiveTool('text');
  };

  const handleExport = () => {
    const jsonBlob = new Blob([JSON.stringify(notebook, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OneNote_${notebook.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#f0f2f5] text-neutral-900 overflow-hidden font-sans antialiased">
      {/* 1. OneNote Ribbon Toolbar */}
      <OneNoteRibbon
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        baseWidth={baseWidth}
        setBaseWidth={setBaseWidth}
        backgroundPattern={backgroundPattern}
        setBackgroundPattern={setBackgroundPattern}
        historyManager={historyManager}
        onClearPage={handleClearPage}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        isHistoryOpen={isHistoryOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExport}
        onInsertTextBox={handleInsertTextBox}
      />

      {/* 2. Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* OneNote Navigation Sidebar */}
        <OneNoteSidebar
          notebookTitle={notebook.title}
          sections={notebook.sections}
          activeSectionIndex={notebook.activeSectionIndex}
          activePageIndex={currentSection.activePageIndex}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSelectSection={handleSelectSection}
          onSelectPage={handleSelectPage}
          onAddSection={handleAddSection}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
        />

        {/* Primary View Switcher based on Ribbon Tab */}
        <div className="flex-1 flex overflow-hidden relative">
          {(activeTab === 'draw' || activeTab === 'home' || activeTab === 'view') && (
            <OneNoteCanvas
              page={currentPage}
              onUpdatePage={handleUpdateCurrentPage}
              activeTool={activeTool}
              activeColor={activeColor}
              baseWidth={baseWidth}
              backgroundPattern={backgroundPattern}
              historyManager={historyManager}
            />
          )}

          {activeTab === 'architecture' && <ArchitectureViewer />}

          {activeTab === 'code' && <CodeExplorer />}
        </div>

        {/* History Timeline Drawer */}
        <HistoryTimeline
          historyManager={historyManager}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      </div>
    </div>
  );
}
