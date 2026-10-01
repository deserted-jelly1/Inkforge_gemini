import React, { useState, useRef, useEffect } from 'react';
import { NotebookData, SectionData, PageData } from '../types/inkforge';
import {
  Book,
  Plus,
  Trash2,
  Copy,
  Edit2,
  PanelLeftClose,
  PanelLeft,
  Search,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Palette,
  FileText,
} from 'lucide-react';

export interface SidebarProps {
  notebook: NotebookData;
  onSelectSection: (sectionId: string) => void;
  onSelectPage: (sectionId: string, pageId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newTitle: string) => void;
  onChangeSectionColor: (sectionId: string, color: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddPage: (sectionId: string) => void;
  onDuplicatePage: (sectionId: string, pageId: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
  onRenameNotebook: (newTitle: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
  onResize?: (width: number) => void;
}

const SECTION_COLORS = [
  '#0284c7', // Sky blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Crimson
  '#4f46e5', // Indigo
  '#0f172a', // Slate
];

export const OneNoteSidebar: React.FC<SidebarProps> = ({
  notebook,
  onSelectSection,
  onSelectPage,
  onAddSection,
  onRenameSection,
  onChangeSectionColor,
  onDeleteSection,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenameNotebook,
  isCollapsed,
  onToggleCollapse,
  width = 260,
  onResize,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state for section rename
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionRenameValue, setSectionRenameValue] = useState('');

  // Editing state for notebook rename
  const [isEditingNotebook, setIsEditingNotebook] = useState(false);
  const [notebookTitleValue, setNotebookTitleValue] = useState(notebook.title);

  // Expanded sections state (default: active section expanded)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    [notebook.activeSectionId]: true,
  });

  // Contextual popup menus state
  const [activeSectionMenuId, setActiveSectionMenuId] = useState<string | null>(null);
  const [activePageMenuId, setActivePageMenuId] = useState<string | null>(null);
  const [colorPickerSectionId, setColorPickerSectionId] = useState<string | null>(null);

  // Resize drag handling
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  // Ensure active section is expanded when changed
  useEffect(() => {
    setExpandedSections((prev) => ({
      ...prev,
      [notebook.activeSectionId]: true,
    }));
  }, [notebook.activeSectionId]);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu-container')) {
        setActiveSectionMenuId(null);
        setActivePageMenuId(null);
        setColorPickerSectionId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || !onResize) return;
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(420, startWidthRef.current + delta));
      onResize(newWidth);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const toggleSectionExpanded = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Cross-section global search
  const isSearching = searchQuery.trim().length > 0;
  const searchResults: {
    section: SectionData;
    page: PageData;
    matchedIn: 'title' | 'text';
    snippet?: string;
  }[] = [];

  if (isSearching) {
    const q = searchQuery.toLowerCase().trim();
    for (const sec of notebook.sections) {
      for (const p of sec.pages) {
        if (p.title.toLowerCase().includes(q)) {
          searchResults.push({ section: sec, page: p, matchedIn: 'title' });
        } else {
          const matchingNote = p.textNotes?.find((n) => n.text.toLowerCase().includes(q));
          if (matchingNote) {
            const idx = matchingNote.text.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 20);
            const end = Math.min(matchingNote.text.length, idx + 40);
            const snippet =
              (start > 0 ? '...' : '') +
              matchingNote.text.slice(start, end) +
              (end < matchingNote.text.length ? '...' : '');
            searchResults.push({ section: sec, page: p, matchedIn: 'text', snippet });
          }
        }
      }
    }
  }

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const startRenameSection = (sec: SectionData) => {
    setEditingSectionId(sec.id);
    setSectionRenameValue(sec.title);
    setActiveSectionMenuId(null);
  };

  const commitRenameSection = (secId: string) => {
    if (sectionRenameValue.trim()) {
      onRenameSection(secId, sectionRenameValue.trim());
    }
    setEditingSectionId(null);
  };

  const commitRenameNotebook = () => {
    if (notebookTitleValue.trim()) {
      onRenameNotebook(notebookTitleValue.trim());
    }
    setIsEditingNotebook(false);
  };

  // 1. Collapsed State: Slim 44px Navigation Rail
  if (isCollapsed) {
    return (
      <nav
        aria-label="Collapsed Notebook Navigation"
        className="w-11 border-r border-neutral-200/80 bg-[#fbfbfa] flex flex-col items-center py-2.5 shrink-0 select-none z-20 text-neutral-700"
      >
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 rounded transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          title="Expand notebook sidebar ([)"
          aria-label="Expand notebook sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="mt-4 flex flex-col items-center gap-2">
          {notebook.sections.map((s) => {
            const isActive = s.id === notebook.activeSectionId;
            return (
              <button
                key={s.id}
                onClick={() => {
                  onToggleCollapse();
                  onSelectSection(s.id);
                }}
                style={{ backgroundColor: s.color }}
                className={`w-2.5 h-6 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                  isActive ? 'scale-125 ring-2 ring-indigo-500/80 shadow-xs' : 'opacity-60 hover:opacity-100 hover:scale-110'
                }`}
                title={`Section: ${s.title} (${s.pages.length} pages)`}
                aria-label={`Open section ${s.title}`}
              />
            );
          })}
        </div>

        <div className="mt-auto mb-1">
          <button
            onClick={() => {
              onToggleCollapse();
              onAddSection();
            }}
            className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Add section"
            aria-label="Add section"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
    );
  }

  // 2. Expanded State: Resizable, Hierarchical Notebook → Section → Page Sidebar
  return (
    <aside
      style={{ width: `${width}px` }}
      aria-label="Notebook Navigation"
      className="relative border-r border-neutral-200/80 bg-[#fcfbfa] flex flex-col shrink-0 select-none z-20 text-neutral-800 text-xs transition-[width] duration-75 ease-out"
    >
      {/* Resizing Edge Drag Handle */}
      {onResize && (
        <div
          onPointerDown={handlePointerDownResize}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40 active:bg-indigo-600 transition-colors z-30"
          title="Drag to resize sidebar"
          aria-label="Resize sidebar"
        />
      )}

      {/* Header: Notebook Context & Collapse */}
      <div className="h-10 px-3 border-b border-neutral-200/70 flex items-center justify-between bg-white/70 backdrop-blur-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-1">
          <Book className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          {isEditingNotebook ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={notebookTitleValue}
                onChange={(e) => setNotebookTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRenameNotebook();
                  if (e.key === 'Escape') setIsEditingNotebook(false);
                }}
                className="w-full text-xs font-semibold px-1.5 py-0.5 border border-indigo-500 rounded bg-white focus:outline-none"
                autoFocus
              />
              <button
                onClick={commitRenameNotebook}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                aria-label="Confirm notebook title"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 truncate group flex-1 cursor-pointer"
              onClick={() => {
                setNotebookTitleValue(notebook.title);
                setIsEditingNotebook(true);
              }}
              title={`Notebook: ${notebook.title} (click to rename)`}
            >
              <span className="font-semibold text-neutral-900 truncate">
                {notebook.title}
              </span>
              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-indigo-600 transition-opacity shrink-0" />
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          title="Collapse sidebar ([)"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Cross-Section Global Search Bar */}
      <div className="p-2 border-b border-neutral-200/70 bg-white/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search notes & titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs bg-neutral-100/80 border border-neutral-200/80 rounded-md focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
            aria-label="Search all notes"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-neutral-400 hover:text-neutral-600 p-0.5"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Hierarchy List or Search Results */}
      {isSearching ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white/70">
          <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1 py-0.5">
            Search Matches ({searchResults.length})
          </div>

          {searchResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No matching pages or notes found.
            </div>
          ) : (
            searchResults.map(({ section, page, snippet }) => {
              const isSelected =
                notebook.activeSectionId === section.id && notebook.activePageId === page.id;
              return (
                <div
                  key={`${section.id}_${page.id}`}
                  onClick={() => onSelectPage(section.id, page.id)}
                  className={`group p-2 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950 font-medium shadow-2xs'
                      : 'border-transparent hover:bg-neutral-100/70 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-semibold text-xs">
                      {page.title.trim() ? page.title : 'Untitled page'}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] text-white shrink-0 font-medium"
                      style={{ backgroundColor: section.color }}
                    >
                      {section.title}
                    </span>
                  </div>

                  {snippet && (
                    <p className="text-[11px] text-neutral-500 mt-1 font-mono line-clamp-2">
                      {snippet}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-400">
                    <span>
                      {formatDate(page.createdAt)} · {page.strokes.length} strokes
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {/* Section List */}
          {notebook.sections.map((sec) => {
            const isSectionActive = sec.id === notebook.activeSectionId;
            const isExpanded = expandedSections[sec.id] ?? false;
            const isEditing = editingSectionId === sec.id;

            return (
              <div key={sec.id} className="space-y-0.5">
                {/* Section Header Row */}
                {isEditing ? (
                  <div className="p-1.5 bg-white rounded-md border border-indigo-500 shadow-xs space-y-1">
                    <input
                      type="text"
                      value={sectionRenameValue}
                      onChange={(e) => setSectionRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRenameSection(sec.id);
                        if (e.key === 'Escape') setEditingSectionId(null);
                      }}
                      className="w-full text-xs font-medium px-1.5 py-0.5 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                      <div className="flex items-center gap-1">
                        {SECTION_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => onChangeSectionColor(sec.id, c)}
                            style={{ backgroundColor: c }}
                            className={`w-3 h-3 rounded-full transition-transform ${
                              sec.color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                            }`}
                            aria-label={`Change section color to ${c}`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => commitRenameSection(sec.id)}
                        className="text-emerald-600 hover:text-emerald-700 p-0.5"
                        aria-label="Save section name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      onSelectSection(sec.id);
                      setExpandedSections((prev) => ({ ...prev, [sec.id]: true }));
                    }}
                    className={`group w-full px-2 py-1.5 rounded-md flex items-center justify-between transition-colors cursor-pointer ${
                      isSectionActive
                        ? 'bg-neutral-200/60 font-semibold text-neutral-900 shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title={sec.title}
                  >
                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 mr-1">
                      <button
                        onClick={(e) => toggleSectionExpanded(sec.id, e)}
                        className="p-0.5 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                        aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="truncate text-xs">{sec.title}</span>
                      <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-1">
                        ({sec.pages.length})
                      </span>
                    </div>

                    {/* Section Contextual Menu Button */}
                    <div className="relative context-menu-container flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSectionMenuId(activeSectionMenuId === sec.id ? null : sec.id);
                          setActivePageMenuId(null);
                        }}
                        className={`p-1 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/80 transition-colors ${
                          activeSectionMenuId === sec.id ? 'opacity-100 text-neutral-900' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="Section options"
                        aria-label={`Options for section ${sec.title}`}
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>

                      {/* Section Contextual Popup */}
                      {activeSectionMenuId === sec.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-6 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs"
                        >
                          <button
                            onClick={() => startRenameSection(sec)}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                          >
                            <Edit2 className="w-3 h-3 text-neutral-500" />
                            <span>Rename Section</span>
                          </button>

                          <button
                            onClick={() => setColorPickerSectionId(colorPickerSectionId === sec.id ? null : sec.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center justify-between text-neutral-700"
                          >
                            <div className="flex items-center gap-2">
                              <Palette className="w-3 h-3 text-neutral-500" />
                              <span>Change Color</span>
                            </div>
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: sec.color }}
                            />
                          </button>

                          {colorPickerSectionId === sec.id && (
                            <div className="px-3 py-1.5 flex items-center gap-1.5 bg-neutral-50 border-y border-neutral-100">
                              {SECTION_COLORS.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => {
                                    onChangeSectionColor(sec.id, c);
                                    setColorPickerSectionId(null);
                                    setActiveSectionMenuId(null);
                                  }}
                                  style={{ backgroundColor: c }}
                                  className={`w-3.5 h-3.5 rounded-full transition-transform ${
                                    sec.color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                                  }`}
                                  aria-label={`Select color ${c}`}
                                />
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => {
                              onAddPage(sec.id);
                              setActiveSectionMenuId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                          >
                            <Plus className="w-3 h-3 text-indigo-600" />
                            <span>Add Page Here</span>
                          </button>

                          {notebook.sections.length > 1 && (
                            <>
                              <div className="my-1 border-t border-neutral-100" />
                              <button
                                onClick={() => {
                                  onDeleteSection(sec.id);
                                  setActiveSectionMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete Section</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-item Pages under Expanded Section */}
                {isExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-neutral-200/60 ml-2 mt-0.5">
                    {sec.pages.map((p) => {
                      const isPageActive = isSectionActive && p.id === notebook.activePageId;

                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelectPage(sec.id, p.id)}
                          className={`group relative px-2 py-1.5 rounded-md cursor-pointer transition-colors flex items-center justify-between gap-1 border-l-2 ${
                            isPageActive
                              ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 font-medium shadow-2xs'
                              : 'border-transparent hover:bg-neutral-100 text-neutral-700'
                          }`}
                          title={p.title.trim() ? p.title : 'Untitled page'}
                        >
                          <div className="flex-1 min-w-0 mr-1">
                            <p className="truncate text-xs leading-snug">
                              {p.title.trim() ? p.title : 'Untitled page'}
                            </p>
                            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              {formatDate(p.createdAt)} · {p.strokes.length} strokes
                            </p>
                          </div>

                          {/* Page Contextual Menu Button */}
                          <div className="relative context-menu-container flex items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePageMenuId(activePageMenuId === p.id ? null : p.id);
                                setActiveSectionMenuId(null);
                              }}
                              className={`p-1 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/80 transition-colors ${
                                activePageMenuId === p.id ? 'opacity-100 text-neutral-900' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              title="Page options"
                              aria-label={`Options for page ${p.title}`}
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>

                            {/* Page Contextual Popup */}
                            {activePageMenuId === p.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-6 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs"
                              >
                                <button
                                  onClick={() => {
                                    onDuplicatePage(sec.id, p.id);
                                    setActivePageMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                                >
                                  <Copy className="w-3 h-3 text-neutral-500" />
                                  <span>Duplicate Page</span>
                                </button>

                                {sec.pages.length > 1 && (
                                  <>
                                    <div className="my-1 border-t border-neutral-100" />
                                    <button
                                      onClick={() => {
                                        onDeletePage(sec.id, p.id);
                                        setActivePageMenuId(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete Page</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Compact Add Page Button */}
                    <button
                      onClick={() => onAddPage(sec.id)}
                      className="w-full text-left px-2 py-1 rounded text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors flex items-center gap-1.5 text-xs font-medium"
                      title="Add a new page to this section"
                      aria-label={`Add page to section ${sec.title}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Page</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Section Button */}
          <div className="pt-2 border-t border-neutral-200/60">
            <button
              onClick={onAddSection}
              className="w-full px-2 py-1.5 rounded-md border border-dashed border-neutral-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-neutral-600 hover:text-indigo-700 transition-colors flex items-center justify-center gap-1.5 font-medium text-xs"
              title="Create a new notebook section"
              aria-label="Add new section"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Section</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
