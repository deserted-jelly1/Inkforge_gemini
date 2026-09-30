import React, { useState } from 'react';
import { ArchitectureViewer } from './ArchitectureViewer';
import { CodeExplorer } from './CodeExplorer';
import { Info, Code, Layers } from 'lucide-react';

export const DeveloperArea: React.FC = () => {
  const [subTab, setSubTab] = useState<'architecture' | 'code'>('code');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900 text-neutral-100">
      {/* Notice Banner */}
      <div className="bg-neutral-950 border-b border-neutral-800 px-5 py-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-neutral-300 space-y-1">
          <p className="font-semibold text-neutral-100">
            Native C++20 / Qt 6 Engine Implementation Note
          </p>
          <p className="text-neutral-400 leading-relaxed">
            The browser notebook currently runs the high-performance TypeScript vector inking engine with IndexedDB persistence.
            The C++20 and Qt 6 codebase shown below represents InkForge's standalone desktop engine reference, designed for native Linux/Windows compilation with low-level libinput digitizer handling.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="h-10 border-b border-neutral-800 bg-neutral-950 px-4 flex items-center gap-2">
        <button
          onClick={() => setSubTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
            subTab === 'code'
              ? 'bg-neutral-800 text-white font-medium'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-indigo-400" />
          <span>C++20 Codebase Explorer</span>
        </button>

        <button
          onClick={() => setSubTab('architecture')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
            subTab === 'architecture'
              ? 'bg-neutral-800 text-white font-medium'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Architecture Specifications (15 Sections)</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'code' ? <CodeExplorer /> : <ArchitectureViewer />}
      </div>
    </div>
  );
};
