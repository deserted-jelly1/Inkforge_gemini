import React, { useState } from 'react';
import { SectionData, PageData } from '../types/inkforge';
import {
  Book,
  Plus,
  Trash2,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Search,
} from 'lucide-react';

interface OneNoteSidebarProps {
  notebookTitle: string;
  sections: SectionData[];
  activeSectionIndex: number;
  activePageIndex: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSection: (index: number) => void;
  onSelectPage: (index: number) => void;
  onAddSection: () => void;
  onAddPage: () => void;
  onDeletePage: (pageIndex: number) => void;
}

export const OneNoteSidebar: React.FC<OneNoteSidebarProps> = ({
  notebookTitle,
  sections,
  activeSectionIndex,
  activePageIndex,
  isCollapsed,
  onToggleCollapse,
  onSelectSection,
  onSelectPage,
  onAddSection,
  onAddPage,
  onDeletePage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (isCollapsed) {
    return (
      <div className="w-10 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center py-2 shrink-0 select-none z-10">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
          title="Expand Notebook Navigation"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          {sections.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                onToggleCollapse();
                onSelectSection(idx);
              }}
              style={{ backgroundColor: s.color }}
              className={`w-2.5 h-6 rounded-full transition-transform ${
                activeSectionIndex === idx ? 'scale-125 ring-2 ring-purple-500' : 'opacity-60'
              }`}
              title={s.title}
            />
          ))}
        </div>
      </div>
    );
  }

  const currentSection = sections[activeSectionIndex] || sections[0];
  const pages = currentSection ? currentSection.pages : [];

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-72 border-r border-neutral-200 dark:border-neutral-800 bg-[#f7f7f9] dark:bg-[#16181d] flex flex-col shrink-0 select-none z-10 text-neutral-800 dark:text-neutral-200 text-xs">
      {/* Notebook Header Bar */}
      <div className="h-10 px-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-[#131519]">
        <div className="flex items-center gap-2 font-medium truncate">
          <Book className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="truncate font-semibold tracking-tight">{notebookTitle}</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
          title="Collapse Navigation"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Main Two-Tier Navigation: Sections & Pages */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tier 1: Sections Column */}
        <div className="w-28 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-[#efeff3] dark:bg-[#111317]">
          <div className="p-2 flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Sections</span>
            <button
              onClick={onAddSection}
              className="p-0.5 hover:bg-neutral-300 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
              title="Add Section"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-1.5 space-y-1">
            {sections.map((sec, idx) => {
              const isActive = activeSectionIndex === idx;
              return (
                <button
                  key={sec.id}
                  onClick={() => onSelectSection(idx)}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-neutral-800 font-medium shadow-xs text-neutral-900 dark:text-white'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <span
                    className="w-2 h-3.5 rounded-xs shrink-0"
                    style={{ backgroundColor: sec.color }}
                  />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier 2: Pages Column */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#16181d]">
          {/* Page search & Add Page Button */}
          <div className="p-2 border-b border-neutral-200 dark:border-neutral-800 space-y-1.5">
            <button
              onClick={onAddPage}
              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-medium hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Page</span>
            </button>

            {pages.length > 5 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-6 pr-2 py-0.5 rounded text-[11px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Pages list */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredPages.map((page, idx) => {
              const isActive = activePageIndex === idx;
              return (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(idx)}
                  className={`group px-2.5 py-2 rounded cursor-pointer transition-colors flex items-start justify-between gap-1 ${
                    isActive
                      ? 'bg-purple-50/80 dark:bg-purple-950/30 text-purple-900 dark:text-purple-100 border-l-2 border-purple-600 font-medium'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs">
                      {page.title.trim() ? page.title : 'Untitled page'}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      {formatDate(page.createdAt)} · {page.strokes.length} strokes
                    </p>
                  </div>

                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(idx);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-500 rounded transition-opacity"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
