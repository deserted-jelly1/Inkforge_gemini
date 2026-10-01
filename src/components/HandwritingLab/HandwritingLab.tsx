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
  setDraftProfileId,
  flushDraftSave,
  subscribeDraft,
  retryDraftLoad,
  retryDraftSave,
  DraftSaveStatus,
  DraftManagerState,
} from '../../handwriting/draftManager';
import { ProfileManager } from './ProfileManager';
import { CaptureStudio } from './CaptureStudio';
import { DocumentComposer } from './DocumentComposer';
import { Info, PenTool, FileText, AlertCircle, X, RefreshCw, Download } from 'lucide-react';

export interface FailedProfileOp {
  key: string;
  profileId?: string;
  profileName: string;
  operation: 'save' | 'create' | 'rename' | 'delete' | 'import';
  error: string;
  timestamp: number;
  unsavedProfile?: HandwritingProfile;
  createName?: string;
}

export const HandwritingLab: React.FC = () => {
  const [profiles, setProfiles] = useState<HandwritingProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeLabTab, setActiveLabTab] = useState<'compose' | 'capture'>('compose');

  // Draft state from draftManager
  const [draft, setDraft] = useState<ComposerDocument | null>(null);
  const [draftManagerState, setDraftManagerState] = useState<DraftManagerState>('uninitialized');
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);

  // Failed profile operations tracked by identity
  const [failedProfileOps, setFailedProfileOps] = useState<Record<string, FailedProfileOp>>({});
  const profileSeqRef = useRef<Record<string, number>>({});

  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Subscribe to navigation-safe draft manager
  useEffect(() => {
    const unsubscribe = subscribeDraft((snapshot) => {
      setDraft(snapshot.draft);
      setDraftManagerState(snapshot.state);
      setDraftSaveStatus(snapshot.saveStatus);
      setDraftLoadError(snapshot.loadError);
    });

    return () => {
      unsubscribe();
      flushDraftSave().catch(console.error);
    };
  }, []);

  // Initial Load with explicit status separation
  const loadLabData = useCallback(async () => {
    setProfileLoadError(null);
    setIsLoaded(false);

    try {
      const profileRes = await listProfiles();
      let loadedProfiles: HandwritingProfile[] = [];

      if (profileRes.status === 'found') {
        loadedProfiles = profileRes.profiles;
      } else if (profileRes.status === 'empty') {
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
      const defaultPersonal = loadedProfiles.find((p) => !p.isDemo) || loadedProfiles[0];
      const initialActiveId = defaultPersonal ? defaultPersonal.id : '';
      setActiveProfileId(initialActiveId);

      // Initialize draft safely through draftManager
      await getOrLoadActiveDraft(initialActiveId);

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

  // Profile operations tracked by identity
  const handleUpdateProfile = useCallback((updated: HandwritingProfile) => {
    const pId = updated.id;
    const seq = (profileSeqRef.current[pId] || 0) + 1;
    profileSeqRef.current[pId] = seq;

    // Optimistically update in-memory profiles list
    setProfiles((prev) => prev.map((p) => (p.id === pId ? updated : p)));

    // Clear previous failure for this profile
    setFailedProfileOps((prev) => {
      if (!prev[pId]) return prev;
      const next = { ...prev };
      delete next[pId];
      return next;
    });

    saveProfile(updated)
      .then(() => {
        if (profileSeqRef.current[pId] === seq) {
          setFailedProfileOps((prev) => {
            if (!prev[pId]) return prev;
            const next = { ...prev };
            delete next[pId];
            return next;
          });
        }
      })
      .catch((err) => {
        if (profileSeqRef.current[pId] === seq) {
          setFailedProfileOps((prev) => ({
            ...prev,
            [pId]: {
              key: pId,
              profileId: pId,
              profileName: updated.name,
              operation: 'save',
              error: err?.message || 'Failed saving profile to storage.',
              timestamp: Date.now(),
              unsavedProfile: updated,
            },
          }));
        }
      });
  }, []);

  const handleRetryFailedProfileOp = (op: FailedProfileOp) => {
    if (op.operation === 'save' || op.operation === 'rename' || op.operation === 'import') {
      if (op.unsavedProfile) {
        handleUpdateProfile(op.unsavedProfile);
      }
    } else if (op.operation === 'create') {
      handleCreatePersonalProfile(op.createName);
    } else if (op.operation === 'delete') {
      if (op.profileId) {
        handleDeleteProfile(op.profileId);
      }
    }
  };

  const handleExportFailedProfileBackup = (op: FailedProfileOp) => {
    if (!op.unsavedProfile) return;
    const blob = new Blob([JSON.stringify(op.unsavedProfile, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InkForge_EmergencyBackup_${op.unsavedProfile.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDismissFailedOp = (key: string) => {
    setFailedProfileOps((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCreatePersonalProfile = (name?: string) => {
    const profileName = name && name.trim() ? name.trim() : 'My Handwriting';
    const newProf = createNewPersonalProfile(profileName);
    const pId = newProf.id;
    const opKey = `create_${pId}`;
    const seq = (profileSeqRef.current[pId] || 0) + 1;
    profileSeqRef.current[pId] = seq;

    setProfiles((prev) => [...prev, newProf]);
    setActiveProfileId(newProf.id);
    // Non-destructive profile reference patch in draft
    setDraftProfileId(newProf.id);

    saveProfile(newProf)
      .then(() => {
        if (profileSeqRef.current[pId] === seq) {
          setFailedProfileOps((prev) => {
            const next = { ...prev };
            delete next[opKey];
            return next;
          });
        }
      })
      .catch((err) => {
        if (profileSeqRef.current[pId] === seq) {
          setFailedProfileOps((prev) => ({
            ...prev,
            [opKey]: {
              key: opKey,
              profileId: pId,
              profileName: profileName,
              operation: 'create',
              error: `Failed creating profile: ${err?.message || 'Storage write error'}`,
              timestamp: Date.now(),
              unsavedProfile: newProf,
              createName: profileName,
            },
          }));
        }
      });
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const target = profiles.find((p) => p.id === id);
    if (!target || target.isDemo) return;
    const updated = { ...target, name: newName, updatedAt: Date.now() };
    handleUpdateProfile(updated);
  };

  const handleDeleteProfile = (id: string) => {
    const target = profiles.find((p) => p.id === id);
    const opKey = `delete_${id}`;
    const remaining = profiles.filter((p) => p.id !== id);
    setProfiles(remaining);
    const nextActiveId = remaining.length > 0 ? remaining[0].id : '';
    setActiveProfileId(nextActiveId);
    // Non-destructive profile reference patch in draft
    setDraftProfileId(nextActiveId);

    deleteProfile(id)
      .then(() => {
        setFailedProfileOps((prev) => {
          const next = { ...prev };
          delete next[opKey];
          return next;
        });
      })
      .catch((err) => {
        setFailedProfileOps((prev) => ({
          ...prev,
          [opKey]: {
            key: opKey,
            profileId: id,
            profileName: target?.name || 'Deleted Profile',
            operation: 'delete',
            error: `Failed deleting profile: ${err?.message || 'Storage delete error'}`,
            timestamp: Date.now(),
          },
        }));
      });
  };

  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    // Non-destructive: patch profileId in current draft without restoring older text
    setDraftProfileId(id);
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
    setImportParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { profile: validated, error } = validateAndParseProfile(text);
      if (error || !validated) {
        setImportParseError(error || 'Failed to parse profile JSON.');
        return;
      }

      const pId = validated.id;
      const opKey = `import_${pId}`;
      const seq = (profileSeqRef.current[pId] || 0) + 1;
      profileSeqRef.current[pId] = seq;

      setProfiles((prev) => {
        const filtered = prev.filter((p) => p.id !== validated.id);
        return [...filtered, validated];
      });
      setActiveProfileId(validated.id);
      setDraftProfileId(validated.id);

      saveProfile(validated)
        .then(() => {
          if (profileSeqRef.current[pId] === seq) {
            setFailedProfileOps((prev) => {
              const next = { ...prev };
              delete next[opKey];
              return next;
            });
          }
        })
        .catch((err) => {
          if (profileSeqRef.current[pId] === seq) {
            setFailedProfileOps((prev) => ({
              ...prev,
              [opKey]: {
                key: opKey,
                profileId: pId,
                profileName: validated.name,
                operation: 'import',
                error: `Failed importing profile to storage: ${err?.message || 'Storage error'}`,
                timestamp: Date.now(),
                unsavedProfile: validated,
              },
            }));
          }
        });
    };
    reader.onerror = () => setImportParseError('Failed to read profile file from disk.');
    reader.readAsText(file);
  };

  // Recoverable error view if initial profile database read fails
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

  const failedOpsList = Object.values(failedProfileOps);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f4f2] text-neutral-900 font-sans">
      {/* 1. Transparent Disclosure Notice Banner & Tab Switcher */}
      <div className="bg-[#fafaf9] text-neutral-700 border-b border-neutral-200/80 px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold text-neutral-900">
              Sample-based handwriting — experimental
            </p>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              This engine composes new words by assembling your captured character stroke vectors. It stores baseline, advance width, and spacing metadata rather than stretching glyphs. It does not perform neural cursive synthesis or learned ligature joining. All captured strokes are stored locally in your browser&apos;s IndexedDB and never uploaded to any server.
            </p>
          </div>
        </div>

        {/* Workspace Sub-tabs */}
        <div className="flex items-center p-0.5 bg-neutral-200/60 rounded-lg shrink-0 self-end md:self-center">
          <button
            onClick={() => {
              flushDraftSave();
              setActiveLabTab('compose');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              activeLabTab === 'compose'
                ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
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
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              activeLabTab === 'capture'
                ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Character Studio</span>
          </button>
        </div>
      </div>

      {/* 2. Distinct Profile Failure Banners per Profile Identity */}
      {failedOpsList.map((op) => (
        <div
          key={op.key}
          className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Profile &quot;{op.profileName}&quot; ({op.operation}):</strong> {op.error}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {op.unsavedProfile && (
              <button
                onClick={() => handleExportFailedProfileBackup(op)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 font-medium transition-colors"
                title={`Export emergency JSON backup for ${op.profileName}`}
              >
                <Download className="w-3 h-3" />
                <span>Emergency Backup</span>
              </button>
            )}
            <button
              onClick={() => handleRetryFailedProfileOp(op)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => handleDismissFailedOp(op.key)}
              className="p-1 hover:bg-rose-100 rounded text-rose-600"
              title="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Import Parse Error Banner */}
      {importParseError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{importParseError}</span>
          </div>
          <button
            onClick={() => setImportParseError(null)}
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
        failedProfileOps={failedProfileOps}
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
            draftManagerState={draftManagerState}
            draftLoadError={draftLoadError}
            draftSaveStatus={draftSaveStatus}
            onUpdateDraft={updateDraft}
            onRetrySaveDraft={retryDraftSave}
            onRetryLoadDraft={() => retryDraftLoad(activeProfileId)}
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
