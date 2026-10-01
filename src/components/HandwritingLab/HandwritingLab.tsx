import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HandwritingProfile, ComposerDocument } from '../../handwriting/types';
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  createNewPersonalProfile,
  createDemoProfile,
  validateAndParseProfile,
} from '../../handwriting/profileStorage';
import {
  getOrLoadActiveDraft,
  updateDraft,
  flushDraftSave,
  subscribeDraft,
  DraftSaveStatus,
} from '../../handwriting/draftManager';
import { PRESET_TEXTS } from './DocumentComposer';
import { ProfileManager } from './ProfileManager';
import { CaptureStudio } from './CaptureStudio';
import { DocumentComposer } from './DocumentComposer';
import { Info, PenTool, FileText, AlertCircle, X, RefreshCw, Download } from 'lucide-react';

export const HandwritingLab: React.FC = () => {
  const [profiles, setProfiles] = useState<HandwritingProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeLabTab, setActiveLabTab] = useState<'compose' | 'capture'>('compose');

  // Draft state managed via draftManager
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
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);

  // Profile status tracking
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Monotonic profile save sequence tracking
  const profileSaveSeqRef = useRef<number>(0);

  // Subscribe to navigation-safe draft manager
  useEffect(() => {
    const unsubscribe = subscribeDraft((updatedDraft, status) => {
      setDraft(updatedDraft);
      setDraftSaveStatus(status);
    });
    return () => {
      unsubscribe();
      flushDraftSave().catch(console.error);
    };
  }, []);

  // Initial Load with explicit status separation
  const loadLabData = useCallback(async () => {
    setProfileLoadError(null);
    setDraftLoadError(null);
    setIsLoaded(false);

    try {
      const profileRes = await listProfiles();
      let loadedProfiles: HandwritingProfile[] = [];

      if (profileRes.status === 'found') {
        loadedProfiles = profileRes.profiles;
      } else if (profileRes.status === 'empty') {
        // Seed only when confirmed empty
        const demo = createDemoProfile();
        const initialPersonal = createNewPersonalProfile('My Handwriting');
        await saveProfile(demo);
        await saveProfile(initialPersonal);
        loadedProfiles = [demo, initialPersonal];
      } else if (profileRes.status === 'error') {
        // On error: preserve storage, do NOT seed, show retry
        setProfileLoadError(profileRes.error);
        setIsLoaded(true);
        return;
      }

      setProfiles(loadedProfiles);
      const defaultPersonal = loadedProfiles.find((p) => !p.isDemo) || loadedProfiles[0];
      const initialActiveId = defaultPersonal ? defaultPersonal.id : '';
      setActiveProfileId(initialActiveId);

      // Load draft safely through draftManager
      const draftRes = await getOrLoadActiveDraft(initialActiveId);
      if (draftRes.status === 'error') {
        setDraftLoadError(draftRes.error || 'Failed loading composer draft.');
      } else {
        setDraft(draftRes.draft);
        if (draftRes.draft.profileId && loadedProfiles.some((p) => p.id === draftRes.draft.profileId)) {
          setActiveProfileId(draftRes.draft.profileId);
        }
      }

      setIsLoaded(true);
    } catch (err: any) {
      setProfileLoadError(err?.message || 'Storage error loading Handwriting Lab.');
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadLabData();
  }, [loadLabData]);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  // Profile operations with monotonic revisions & error reporting
  const handleUpdateProfile = useCallback((updated: HandwritingProfile) => {
    const currentSeq = ++profileSaveSeqRef.current;
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setProfileSaveStatus('saving');
    setProfileErrorMessage(null);

    saveProfile(updated)
      .then(() => {
        if (currentSeq >= profileSaveSeqRef.current) {
          setProfileSaveStatus('idle');
        }
      })
      .catch((err) => {
        if (currentSeq >= profileSaveSeqRef.current) {
          setProfileSaveStatus('error');
          setProfileErrorMessage(err.message || 'Failed saving profile.');
        }
      });
  }, []);

  const handleRetryProfileSave = () => {
    if (!activeProfile) return;
    handleUpdateProfile(activeProfile);
  };

  const handleCreatePersonalProfile = (name?: string) => {
    const profileName = name && name.trim() ? name.trim() : 'My Handwriting';
    const newProf = createNewPersonalProfile(profileName);
    const currentSeq = ++profileSaveSeqRef.current;
    setProfileSaveStatus('saving');

    saveProfile(newProf)
      .then(() => {
        if (currentSeq >= profileSaveSeqRef.current) {
          setProfiles((prev) => [...prev, newProf]);
          setActiveProfileId(newProf.id);
          setProfileSaveStatus('idle');
          updateDraft({ ...draft, profileId: newProf.id });
        }
      })
      .catch((err) => {
        setProfileSaveStatus('error');
        setProfileErrorMessage(`Failed creating profile: ${err.message}`);
      });
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const target = profiles.find((p) => p.id === id);
    if (!target || target.isDemo) return;
    const updated = { ...target, name: newName, updatedAt: Date.now() };
    handleUpdateProfile(updated);
  };

  const handleDeleteProfile = (id: string) => {
    const currentSeq = ++profileSaveSeqRef.current;
    setProfileSaveStatus('saving');

    deleteProfile(id)
      .then(() => {
        if (currentSeq >= profileSaveSeqRef.current) {
          const remaining = profiles.filter((p) => p.id !== id);
          setProfiles(remaining);
          const nextActiveId = remaining.length > 0 ? remaining[0].id : '';
          setActiveProfileId(nextActiveId);
          setProfileSaveStatus('idle');
          updateDraft({ ...draft, profileId: nextActiveId });
        }
      })
      .catch((err) => {
        setProfileSaveStatus('error');
        setProfileErrorMessage(`Failed deleting profile: ${err.message}`);
      });
  };

  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    updateDraft({ ...draft, profileId: id });
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

      const currentSeq = ++profileSaveSeqRef.current;
      setProfileSaveStatus('saving');

      saveProfile(validated)
        .then(() => {
          if (currentSeq >= profileSaveSeqRef.current) {
            setProfiles((prev) => {
              const filtered = prev.filter((p) => p.id !== validated.id);
              return [...filtered, validated];
            });
            setActiveProfileId(validated.id);
            setProfileSaveStatus('idle');
            updateDraft({ ...draft, profileId: validated.id });
          }
        })
        .catch((err) => {
          setProfileSaveStatus('error');
          setProfileErrorMessage(`Failed importing profile: ${err.message}`);
        });
    };
    reader.onerror = () => setImportError('Failed to read profile file from disk.');
    reader.readAsText(file);
  };

  // Recoverable error view if profile IndexedDB read fails
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
            onClick={() => {
              flushDraftSave();
              setActiveLabTab('compose');
            }}
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
            onClick={() => {
              flushDraftSave();
              setActiveLabTab('capture');
            }}
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

      {/* 2. Profile Save Error Banner with Emergency Download & Retry */}
      {profileSaveStatus === 'error' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{profileErrorMessage || 'Failed saving handwriting profile.'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportProfile}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 font-medium transition-colors"
              title="Export current in-memory profile as backup JSON"
            >
              <Download className="w-3 h-3" />
              <span>Emergency Backup</span>
            </button>
            <button
              onClick={handleRetryProfileSave}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Save</span>
            </button>
          </div>
        </div>
      )}

      {/* Draft Load Error Banner */}
      {draftLoadError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{draftLoadError}</span>
          </div>
          <button
            onClick={loadLabData}
            className="underline font-medium text-amber-900 hover:text-amber-950"
          >
            Retry Load
          </button>
        </div>
      )}

      {/* Import Error Banner */}
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
            onUpdateDraft={updateDraft}
            draftSaveStatus={draftSaveStatus}
            onRetrySaveDraft={() => flushDraftSave()}
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
