import React, { useState, useRef } from 'react';
import { HandwritingProfile } from '../../handwriting/types';
import { isStarterSample } from '../../handwriting/profileStorage';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Check,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ProfileManagerProps {
  profiles: HandwritingProfile[];
  activeProfile: HandwritingProfile | null;
  onSelectProfile: (id: string) => void;
  onCreateProfile: (name: string) => void;
  onRenameProfile: (id: string, newName: string) => void;
  onDeleteProfile: (id: string) => void;
  onExportProfile: () => void;
  onImportProfile: (file: File) => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onExportProfile,
  onImportProfile,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(activeProfile?.name || '');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCommitName = () => {
    if (activeProfile && nameInput.trim() && !activeProfile.isDemo) {
      onRenameProfile(activeProfile.id, nameInput.trim());
    }
    setIsEditingName(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportProfile(file);
      e.target.value = '';
    }
  };

  const capturedGlyphCount = activeProfile
    ? Object.keys(activeProfile.glyphs).filter((k) => {
        const samples = activeProfile.glyphs[k];
        if (!samples || samples.length === 0) return false;
        if (activeProfile.isDemo) return samples[0].strokes.length > 0;
        return samples.some((s) => !isStarterSample(s) && s.strokes.length > 0);
      }).length
    : 0;

  return (
    <div className="bg-white border-b border-neutral-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      {/* Left: Profile Switcher & Renaming */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-neutral-900">
          <span className="text-neutral-500 font-normal">Active Profile:</span>
          {activeProfile ? (
            isEditingName && !activeProfile.isDemo ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  className="px-1.5 py-0.5 border border-indigo-500 rounded bg-white text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleCommitName}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <select
                  value={activeProfile.id}
                  onChange={(e) => onSelectProfile(e.target.value)}
                  className="font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border-0 rounded px-2 py-1 cursor-pointer focus:outline-none"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDemo ? '(Demo Template)' : ''}
                    </option>
                  ))}
                </select>

                {!activeProfile.isDemo && (
                  <button
                    onClick={() => {
                      setNameInput(activeProfile.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-neutral-400 hover:text-indigo-600 rounded transition-colors"
                    title="Rename personal profile"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          ) : (
            <span className="text-neutral-500 italic">No profile selected</span>
          )}
        </div>

        {activeProfile && (
          <>
            <span className="text-neutral-400 font-mono">·</span>
            <span className="text-neutral-500 font-mono">
              {activeProfile.isDemo ? 'Demo Template' : `${capturedGlyphCount} characters captured`}
            </span>
          </>
        )}

        <button
          onClick={() => {
            const name = prompt('Enter a name for the new personal profile (starts empty):');
            if (name && name.trim()) {
              onCreateProfile(name.trim());
            }
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors"
          title="Create a new empty personal profile"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Profile</span>
        </button>
      </div>

      {/* Right: Actions & Local Storage Guarantee */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local IndexedDB</span>
        </div>

        {activeProfile && (
          <button
            onClick={onExportProfile}
            className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
            title="Export profile JSON"
          >
            <Download className="w-3.5 h-3.5 text-neutral-600" />
            <span>Export JSON</span>
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
          title="Import profile JSON"
        >
          <Upload className="w-3.5 h-3.5 text-neutral-600" />
          <span>Import JSON</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        {activeProfile && !activeProfile.isDemo && (
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete profile "${activeProfile.name}"?`)) {
                onDeleteProfile(activeProfile.id);
              }
            }}
            className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Delete this personal profile"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
