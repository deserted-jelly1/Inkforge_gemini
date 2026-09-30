import React, { useState, useEffect, useCallback } from 'react';
import { HandwritingProfile } from '../../handwriting/types';
import {
  listProfiles,
  saveProfile,
  loadProfile,
  deleteProfile,
  createNewProfile,
  validateAndParseProfile,
} from '../../handwriting/profileStorage';
import { populateStarterAlphabet } from '../../handwriting/defaultGlyphs';
import { ProfileManager } from './ProfileManager';
import { CaptureStudio } from './CaptureStudio';
import { DocumentComposer } from './DocumentComposer';
import { Info, Sparkles, PenTool, FileText, AlertCircle, X } from 'lucide-react';

export const HandwritingLab: React.FC = () => {
  const [profiles, setProfiles] = useState<HandwritingProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeLabTab, setActiveLabTab] = useState<'capture' | 'compose'>('compose');
  const [importError, setImportError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load profiles on mount
  useEffect(() => {
    listProfiles().then((loaded) => {
      if (loaded.length > 0) {
        setProfiles(loaded);
        setActiveProfileId(loaded[0].id);
      } else {
        // Create initial starter profile
        const starter = createNewProfile('My Print Handwriting');
        starter.glyphs = populateStarterAlphabet();
        saveProfile(starter).then(() => {
          setProfiles([starter]);
          setActiveProfileId(starter.id);
        });
      }
      setIsLoaded(true);
    });
  }, []);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const handleUpdateProfile = useCallback((updated: HandwritingProfile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    saveProfile(updated).catch(console.error);
  }, []);

  const handleCreateProfile = (name: string) => {
    const newProf = createNewProfile(name);
    // Seed standard starter characters for immediate typing convenience
    newProf.glyphs = populateStarterAlphabet();
    saveProfile(newProf).then(() => {
      setProfiles((prev) => [...prev, newProf]);
      setActiveProfileId(newProf.id);
    });
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const target = profiles.find((p) => p.id === id);
    if (!target) return;
    const updated = { ...target, name: newName, updatedAt: Date.now() };
    handleUpdateProfile(updated);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) return;
    deleteProfile(id).then(() => {
      const remaining = profiles.filter((p) => p.id !== id);
      setProfiles(remaining);
      setActiveProfileId(remaining[0].id);
    });
  };

  const handleExportProfile = () => {
    if (!activeProfile) return;
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InkForge_Profile_${activeProfile.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProfile = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { profile: validated, error } = validateAndParseProfile(text);
      if (error || !validated) {
        setImportError(error || 'Failed to parse profile JSON.');
        return;
      }

      saveProfile(validated).then(() => {
        setProfiles((prev) => {
          const filtered = prev.filter((p) => p.id !== validated.id);
          return [...filtered, validated];
        });
        setActiveProfileId(validated.id);
      });
    };
    reader.onerror = () => setImportError('Failed to read file from disk.');
    reader.readAsText(file);
  };

  if (!isLoaded || !activeProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50 text-neutral-500 font-sans text-xs">
        Loading Handwriting Lab...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-100 text-neutral-900 font-sans">
      {/* 1. Transparent Disclosure Notice Banner */}
      <div className="bg-neutral-900 text-neutral-300 border-b border-neutral-800 px-4 py-2.5 flex items-start justify-between text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold text-white">
              Sample-based handwriting — experimental
            </p>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              This engine composes new words by assembling your captured character stroke vectors. It stores baseline, advance width, and spacing metadata rather than stretching glyphs. It does not perform neural cursive synthesis or learned ligature joining. All captured strokes are stored locally in your browser's IndexedDB and never uploaded to any server.
            </p>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button
            onClick={() => setActiveLabTab('compose')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeLabTab === 'compose'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Preview</span>
          </button>

          <button
            onClick={() => setActiveLabTab('capture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeLabTab === 'capture'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Character Studio</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {importError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            onClick={() => setImportError(null)}
            className="p-1 hover:bg-rose-100 rounded text-rose-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Profile Manager Bar */}
      <ProfileManager
        profiles={profiles}
        activeProfile={activeProfile}
        onSelectProfile={(id) => setActiveProfileId(id)}
        onCreateProfile={handleCreateProfile}
        onRenameProfile={handleRenameProfile}
        onDeleteProfile={handleDeleteProfile}
        onExportProfile={handleExportProfile}
        onImportProfile={handleImportProfile}
      />

      {/* 4. Active Workspace Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeLabTab === 'compose' ? (
          <DocumentComposer profile={activeProfile} />
        ) : (
          <CaptureStudio
            profile={activeProfile}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </div>
    </div>
  );
};
