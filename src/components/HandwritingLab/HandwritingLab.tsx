import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HandwritingProfile, ComposerDocument } from '../../handwriting/types';
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  createNewPersonalProfile,
  createDemoProfile,
  validateAndParseProfile,
  loadActiveDraft,
  saveActiveDraft,
} from '../../handwriting/profileStorage';
import { PRESET_TEXTS } from './DocumentComposer';
import { ProfileManager } from './ProfileManager';
import { CaptureStudio } from './CaptureStudio';
import { DocumentComposer } from './DocumentComposer';
import { Info, PenTool, FileText, AlertCircle, X, RefreshCw } from 'lucide-react';

export const HandwritingLab: React.FC = () => {
  const [profiles, setProfiles] = useState<HandwritingProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeLabTab, setActiveLabTab] = useState<'compose' | 'capture'>('compose');

  // Draft persistence state
  const [draft, setDraft] = useState<ComposerDocument>({
    schemaVersion: 1,
    id: 'composer_draft_active',
    title: 'Handwriting Draft',
    text: PRESET_TEXTS[0].text,
    profileId: '',
    options: {
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
      fontSize: 24,
      lineHeight: 1.5,
      letterSpacing: 1.0,
      wordSpacing: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Debounce refs for draft and profile autosaves
  const draftSaveTimeoutRef = useRef<any>(null);
  const draftSaveSeqRef = useRef<number>(0);
  const pendingDraftRef = useRef<ComposerDocument>(draft);

  // Load profiles and draft on mount
  const loadLabData = useCallback(async () => {
    setProfileLoadError(null);
    setIsLoaded(false);

    try {
      const profileRes = await listProfiles();
      let loadedProfiles: HandwritingProfile[] = [];

      if (profileRes.status === 'found') {
        loadedProfiles = profileRes.profiles;
      } else if (profileRes.status === 'empty') {
        // Initialize starter demo profile and an empty personal profile
        const demo = createDemoProfile();
        const initialPersonal = createNewPersonalProfile('My Handwriting');
        await saveProfile(demo);
        await saveProfile(initialPersonal);
        loadedProfiles = [demo, initialPersonal];
      } else if (profileRes.status === 'error') {
        setProfileLoadError(profileRes.error);
        setIsLoaded(true);
        return;
      }

      setProfiles(loadedProfiles);
      // Select the personal profile by default if present, else first profile
      const defaultPersonal = loadedProfiles.find((p) => !p.isDemo) || loadedProfiles[0];
      const initialActiveId = defaultPersonal ? defaultPersonal.id : '';
      setActiveProfileId(initialActiveId);

      // Load active composer draft from IndexedDB
      const draftRes = await loadActiveDraft();
      if (draftRes.status === 'found') {
        setDraft(draftRes.draft);
        pendingDraftRef.current = draftRes.draft;
        if (draftRes.draft.profileId && loadedProfiles.some((p) => p.id === draftRes.draft.profileId)) {
          setActiveProfileId(draftRes.draft.profileId);
        }
      } else {
        // Create initial draft
        const initDraft: ComposerDocument = {
          schemaVersion: 1,
          id: 'composer_draft_active',
          title: 'Handwriting Draft',
          text: PRESET_TEXTS[0].text,
          profileId: initialActiveId,
          options: {
            pageWidth: 595,
            pageHeight: 842,
            margins: { top: 48, right: 48, bottom: 48, left: 48 },
            fontSize: 24,
            lineHeight: 1.5,
            letterSpacing: 1.0,
            wordSpacing: 1.0,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDraft(initDraft);
        pendingDraftRef.current = initDraft;
        saveActiveDraft(initDraft).catch(console.error);
      }

      setIsLoaded(true);
    } catch (err: any) {
      setProfileLoadError(err?.message || 'Failed initializing Handwriting Lab storage.');
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadLabData();
  }, [loadLabData]);

  // Debounced draft autosave
  const triggerDraftSave = useCallback((updatedDraft: ComposerDocument) => {
    setDraft(updatedDraft);
    pendingDraftRef.current = updatedDraft;
    setDraftSaveStatus('saving');

    const currentSeq = ++draftSaveSeqRef.current;
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = setTimeout(() => {
      saveActiveDraft(pendingDraftRef.current)
        .then(() => {
          if (currentSeq >= draftSaveSeqRef.current) {
            setDraftSaveStatus('idle');
          }
        })
        .catch((err) => {
          console.error('Draft autosave failed:', err);
          setDraftSaveStatus('error');
        });
    }, 600);
  }, []);

  const handleRetrySaveDraft = () => {
    const currentSeq = ++draftSaveSeqRef.current;
    setDraftSaveStatus('saving');
    saveActiveDraft(pendingDraftRef.current)
      .then(() => {
        if (currentSeq >= draftSaveSeqRef.current) {
          setDraftSaveStatus('idle');
        }
      })
      .catch(() => setDraftSaveStatus('error'));
  };

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  // Profile operations
  const handleUpdateProfile = useCallback((updated: HandwritingProfile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    saveProfile(updated).catch(console.error);
  }, []);

  const handleCreatePersonalProfile = (name?: string) => {
    const profileName = name && name.trim() ? name.trim() : 'My Handwriting';
    // Personal profiles start completely empty
    const newProf = createNewPersonalProfile(profileName);
    saveProfile(newProf).then(() => {
      setProfiles((prev) => [...prev, newProf]);
      setActiveProfileId(newProf.id);
      triggerDraftSave({ ...draft, profileId: newProf.id });
    });
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const target = profiles.find((p) => p.id === id);
    if (!target || target.isDemo) return;
    const updated = { ...target, name: newName, updatedAt: Date.now() };
    handleUpdateProfile(updated);
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id).then(() => {
      const remaining = profiles.filter((p) => p.id !== id);
      setProfiles(remaining);
      const nextActiveId = remaining.length > 0 ? remaining[0].id : '';
      setActiveProfileId(nextActiveId);
      triggerDraftSave({ ...draft, profileId: nextActiveId });
    });
  };

  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    triggerDraftSave({ ...draft, profileId: id });
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
        triggerDraftSave({ ...draft, profileId: validated.id });
      });
    };
    reader.onerror = () => setImportError('Failed to read profile file from disk.');
    reader.readAsText(file);
  };

  // Recoverable error view if IndexedDB read fails
  if (profileLoadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50 p-6 text-neutral-800 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h2 className="text-base font-semibold">Handwriting Storage Failure</h2>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            InkForge could not open your local handwriting profiles. Your notebook data is safe in its separate database.
          </p>
          <div className="p-2.5 rounded bg-neutral-100 font-mono text-[11px] text-neutral-700 break-all">
            {profileLoadError}
          </div>
          <button
            onClick={loadLabData}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-medium text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Handwriting Lab</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50 text-neutral-500 font-sans text-xs">
        Loading Handwriting Lab...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-100 text-neutral-900 font-sans">
      {/* 1. Transparent Disclosure Notice Banner & Tab Switcher */}
      <div className="bg-neutral-900 text-neutral-300 border-b border-neutral-800 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold text-white">
              Sample-based handwriting — experimental
            </p>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              This engine composes new words by assembling your captured character stroke vectors. It stores baseline, advance width, and spacing metadata rather than stretching glyphs. It does not perform neural cursive synthesis or learned ligature joining. All captured strokes are stored locally in your browser&apos;s IndexedDB and never uploaded to any server.
            </p>
          </div>
        </div>

        {/* Workspace Sub-tabs */}
        <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
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
        onSelectProfile={handleSelectProfile}
        onCreateProfile={handleCreatePersonalProfile}
        onRenameProfile={handleRenameProfile}
        onDeleteProfile={handleDeleteProfile}
        onExportProfile={handleExportProfile}
        onImportProfile={handleImportProfile}
      />

      {/* 4. Active Workspace Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeLabTab === 'compose' ? (
          <DocumentComposer
            profile={activeProfile}
            draft={draft}
            onUpdateDraft={triggerDraftSave}
            draftSaveStatus={draftSaveStatus}
            onRetrySaveDraft={handleRetrySaveDraft}
          />
        ) : (
          <CaptureStudio
            profile={activeProfile}
            onUpdateProfile={handleUpdateProfile}
            onCreateNewPersonalProfile={() => handleCreatePersonalProfile()}
          />
        )}
      </div>
    </div>
  );
};
