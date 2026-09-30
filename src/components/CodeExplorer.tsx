import React, { useState } from 'react';
import { CODEBASE_FILES } from '../data/codebase';
import { FileCode, Copy, Check, Terminal, FolderTree } from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState(CODEBASE_FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-950 text-neutral-200">
      {/* File List Sidebar */}
      <aside className="w-80 border-r border-neutral-800 bg-neutral-900/40 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">
              C++20 & Qt 6 Codebase
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 font-mono">
              {CODEBASE_FILES.length} Files Ready
            </p>
          </div>
          <FolderTree className="w-4 h-4 text-neutral-500" />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {CODEBASE_FILES.map((file) => {
            const isSelected = selectedFile.path === file.path;
            return (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono transition-colors flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-neutral-800 text-amber-400 border border-neutral-700/60'
                    : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-neutral-500'}`} />
                  <span className="truncate">{file.path}</span>
                </div>
                <span className="text-[10px] text-neutral-500 truncate pl-5">
                  {file.category.toUpperCase()} · {file.language}
                </span>
              </button>
            );
          })}
        </div>

        {/* Windows / Linux Build command tip */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 text-[11px] font-mono text-neutral-400">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold mb-1">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Build Command</span>
          </div>
          <p className="text-neutral-500">cmake -B build -S . -G Ninja</p>
          <p className="text-neutral-500">cmake --build build</p>
        </div>
      </aside>

      {/* Code Viewer */}
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
        {/* File header */}
        <div className="h-12 border-b border-neutral-800 bg-neutral-900/60 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-neutral-200">
              {selectedFile.path}
            </span>
            <span className="text-xs text-neutral-500">·</span>
            <span className="text-xs text-neutral-400">{selectedFile.description}</span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-neutral-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-5 font-mono text-xs text-neutral-300 leading-relaxed bg-[#0d1117]">
          <pre className="select-text">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </main>
    </div>
  );
};
