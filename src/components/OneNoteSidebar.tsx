import React, { useState } from 'react';
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
  FileText,
} from 'lucide-react';

interface SidebarProps {
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
}

const SECTION_COLORS = [
  '#0284c7', // Sky blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Crimson
  '#4f46e5', // Indigo
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state for section rename
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionRenameValue, setSectionRenameValue] = useState('');

  // Editing state for notebook rename
  const [isEditingNotebook, setIsEditingNotebook] = useState(false);
  const [notebookTitleValue, setNotebookTitleValue] = useState(notebook.title);

  const activeSection =
    notebook.sections.find((s) => s.id === notebook.activeSectionId) || notebook.sections[0];
  const pages = activeSection ? activeSection.pages : [];

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
            const snippet = (start > 0 ? '...' : '') + matchingNote.text.slice(start, end) + (end < matchingNote.text.length ? '...' : '');
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

  if (isCollapsed) {
    return (
      <div className="w-11 border-r border-neutral-200 bg-neutral-50 flex flex-col items-center py-2.5 shrink-0 select-none z-20">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors"
          title="Expand notebook sidebar"
          aria-label="Expand sidebar"
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
                className={`w-2.5 h-6 rounded-full transition-transform ${
                  isActive ? 'scale-125 ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100'
                }`}
                title={s.title}
                aria-label={`Switch to section ${s.title}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside className="w-80 border-r border-neutral-200 bg-[#f8fafc] flex flex-col shrink-0 select-none z-20 text-neutral-800 text-xs">
      {/* Notebook Header Bar */}
      <div className="h-11 px-3 border-b border-neutral-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-1">
          <Book className="w-4 h-4 text-indigo-600 shrink-0" />
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
                className="w-full text-xs font-semibold px-1 py-0.5 border border-indigo-500 rounded bg-white focus:outline-none"
                autoFocus
              />
              <button
                onClick={commitRenameNotebook}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                aria-label="Confirm notebook title"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 truncate group flex-1">
              <span className="font-semibold text-neutral-900 truncate">
                {notebook.title}
              </span>
              <button
                onClick={() => {
                  setNotebookTitleValue(notebook.title);
                  setIsEditingNotebook(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-indigo-600 text-neutral-400 rounded transition-opacity"
                title="Rename notebook"
                aria-label="Rename notebook"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Global Cross-Section Search Bar */}
      <div className="p-2 border-b border-neutral-200 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search all notes & titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs bg-neutral-100 border border-neutral-200 rounded-md focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
            aria-label="Search all notes"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-neutral-400 hover:text-neutral-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Tier Area or Search Results Area */}
      {isSearching ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 py-1">
            Search Results ({searchResults.length})
          </div>

          {searchResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No matching pages or notes found.
            </div>
          ) : (
            searchResults.map(({ section, page, matchedIn, snippet }) => {
              const isSelected =
                notebook.activeSectionId === section.id && notebook.activePageId === page.id;
              return (
                <div
                  key={`${section.id}_${page.id}`}
                  onClick={() => onSelectPage(section.id, page.id)}
                  className={`group p-2 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-medium'
                      : 'border-transparent hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-semibold text-xs">
                      {page.title.trim() ? page.title : 'Untitled page'}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] text-white shrink-0"
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
                    <span>{formatDate(page.createdAt)} · {page.strokes.length} strokes</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(section.id, page.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 transition-opacity"
                      title="Delete page"
                      aria-label="Delete page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Tier 1: Sections Column */}
          <div className="w-32 border-r border-neutral-200 flex flex-col bg-[#f1f5f9]">
            <div className="p-2 flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              <span>Sections</span>
              <button
                onClick={onAddSection}
                className="p-1 hover:bg-neutral-200 rounded text-neutral-600 transition-colors"
                title="Add Section"
                aria-label="Add Section"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 space-y-1">
              {notebook.sections.map((sec) => {
                const isActive = sec.id === notebook.activeSectionId;
                const isEditing = editingSectionId === sec.id;

                if (isEditing) {
                  return (
                    <div key={sec.id} className="p-1 bg-white rounded border border-indigo-500">
                      <input
                        type="text"
                        value={sectionRenameValue}
                        onChange={(e) => setSectionRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRenameSection(sec.id);
                          if (e.key === 'Escape') setEditingSectionId(null);
                        }}
                        className="w-full text-xs px-1 py-0.5 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-neutral-100">
                        <div className="flex items-center gap-1">
                          {SECTION_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => onChangeSectionColor(sec.id, c)}
                              style={{ backgroundColor: c }}
                              className="w-2.5 h-2.5 rounded-full"
                              aria-label={`Change section color to ${c}`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => commitRenameSection(sec.id)}
                          className="text-emerald-600 p-0.5"
                          aria-label="Save section name"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={sec.id}
                    onClick={() => onSelectSection(sec.id)}
                    className={`group w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white font-semibold text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:bg-neutral-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2 h-3.5 rounded-xs shrink-0"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="truncate">{sec.title}</span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenameSection(sec);
                        }}
                        className="p-0.5 text-neutral-400 hover:text-indigo-600"
                        title="Rename section"
                        aria-label="Rename section"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {notebook.sections.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSection(sec.id);
                          }}
                          className="p-0.5 text-neutral-400 hover:text-rose-600"
                          title="Delete section"
                          aria-label="Delete section"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier 2: Pages Column */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Add Page Action */}
            <div className="p-2 border-b border-neutral-200">
              <button
                onClick={() => onAddPage(activeSection.id)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 hover:bg-indigo-100 transition-colors"
                aria-label="Add new page"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Page</span>
              </button>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {pages.map((p) => {
                const isActive = p.id === notebook.activePageId;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPage(activeSection.id, p.id)}
                    className={`group px-2.5 py-2 rounded-md cursor-pointer transition-colors flex items-start justify-between gap-1 border-l-2 ${
                      isActive
                        ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 font-medium'
                        : 'border-transparent hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">
                        {p.title.trim() ? p.title : 'Untitled page'}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        {formatDate(p.createdAt)} · {p.strokes.length} strokes
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicatePage(activeSection.id, p.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-indigo-600 rounded"
                        title="Duplicate page"
                        aria-label="Duplicate page"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePage(activeSection.id, p.id);
                          }}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                          title="Delete page"
                          aria-label="Delete page"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
