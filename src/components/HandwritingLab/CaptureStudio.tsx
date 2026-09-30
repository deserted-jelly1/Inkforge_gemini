import React, { useState } from 'react';
import { HandwritingProfile, CharacterSample, SUPPORTED_CHARACTERS } from '../../handwriting/types';
import { CaptureCell } from './CaptureCell';
import { CheckCircle2, CircleDashed } from 'lucide-react';

interface CaptureStudioProps {
  profile: HandwritingProfile;
  onUpdateProfile: (updated: HandwritingProfile) => void;
}

export const CaptureStudio: React.FC<CaptureStudioProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const [activeCategory, setActiveCategory] = useState<'lowercase' | 'uppercase' | 'digits' | 'punctuation'>('lowercase');
  const [selectedChar, setSelectedChar] = useState<string>('a');

  // Total supported character count
  const allCharacters = [
    ...SUPPORTED_CHARACTERS.lowercase,
    ...SUPPORTED_CHARACTERS.uppercase,
    ...SUPPORTED_CHARACTERS.digits,
    ...SUPPORTED_CHARACTERS.punctuation,
  ];

  const capturedCount = allCharacters.filter(
    (c) => profile.glyphs[c] && profile.glyphs[c].length > 0 && profile.glyphs[c][0].strokes.length > 0
  ).length;

  const currentCategoryChars = SUPPORTED_CHARACTERS[activeCategory];

  const handleSaveSample = (sample: CharacterSample) => {
    const existingSamples = profile.glyphs[selectedChar] || [];
    const sampleIdx = existingSamples.findIndex((s) => s.id === sample.id);

    let updatedList: CharacterSample[];
    if (sampleIdx >= 0) {
      updatedList = [...existingSamples];
      updatedList[sampleIdx] = sample;
    } else {
      updatedList = [...existingSamples, sample];
    }

    // Filter out completely empty samples
    updatedList = updatedList.filter((s) => s.strokes && s.strokes.length > 0);

    const updatedProfile: HandwritingProfile = {
      ...profile,
      updatedAt: Date.now(),
      glyphs: {
        ...profile.glyphs,
        [selectedChar]: updatedList,
      },
    };

    onUpdateProfile(updatedProfile);
  };

  const handleDeleteSample = (sampleId: string) => {
    const existing = profile.glyphs[selectedChar] || [];
    const filtered = existing.filter((s) => s.id !== sampleId);

    const updatedProfile: HandwritingProfile = {
      ...profile,
      updatedAt: Date.now(),
      glyphs: {
        ...profile.glyphs,
        [selectedChar]: filtered,
      },
    };

    onUpdateProfile(updatedProfile);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-50 text-neutral-800 text-xs">
      {/* Left: Character Categories & Grid */}
      <div className="flex-1 flex flex-col border-r border-neutral-200 overflow-hidden">
        {/* Top Progress & Category Selector */}
        <div className="p-3 border-b border-neutral-200 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-900 text-sm">Character Library</span>
            <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
              {capturedCount} / {allCharacters.length} captured ({Math.round((capturedCount / allCharacters.length) * 100)}%)
            </span>
          </div>

          <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(capturedCount / allCharacters.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => {
                setActiveCategory('lowercase');
                setSelectedChar('a');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'lowercase'
                  ? 'bg-neutral-900 text-white font-medium shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Lowercase (a-z)
            </button>
            <button
              onClick={() => {
                setActiveCategory('uppercase');
                setSelectedChar('A');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'uppercase'
                  ? 'bg-neutral-900 text-white font-medium shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Uppercase (A-Z)
            </button>
            <button
              onClick={() => {
                setActiveCategory('digits');
                setSelectedChar('0');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'digits'
                  ? 'bg-neutral-900 text-white font-medium shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Digits (0-9)
            </button>
            <button
              onClick={() => {
                setActiveCategory('punctuation');
                setSelectedChar('.');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'punctuation'
                  ? 'bg-neutral-900 text-white font-medium shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Punctuation
            </button>
          </div>
        </div>

        {/* Character Tile Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
            {currentCategoryChars.map((char) => {
              const samples = profile.glyphs[char] || [];
              const isCaptured = samples.length > 0 && samples[0].strokes.length > 0;
              const isSelected = selectedChar === char;

              return (
                <button
                  key={char}
                  onClick={() => setSelectedChar(char)}
                  className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-xs'
                  }`}
                >
                  <div className="w-full flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="font-mono">{samples.length > 0 ? `${samples.length}x` : ''}</span>
                    {isCaptured ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <CircleDashed className="w-3.5 h-3.5 text-neutral-300" />
                    )}
                  </div>

                  <span className="text-2xl font-bold font-mono my-2 text-neutral-800">
                    {char}
                  </span>

                  <span className={`text-[10px] ${isCaptured ? 'text-emerald-700 font-medium' : 'text-neutral-400'}`}>
                    {isCaptured ? 'Ready' : 'Missing'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Active Capture Cell Studio */}
      <div className="w-80 border-l border-neutral-200 p-4 flex flex-col items-center bg-white overflow-y-auto">
        <CaptureCell
          char={selectedChar}
          samples={profile.glyphs[selectedChar] || []}
          onSaveSample={handleSaveSample}
          onDeleteSample={handleDeleteSample}
        />

        <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 space-y-1.5 leading-relaxed">
          <p className="font-semibold text-neutral-800">Inking Tips for {selectedChar}:</p>
          <ul className="list-disc list-inside space-y-1 text-neutral-500">
            <li>Write naturally along the blue x-height and solid indigo baseline.</li>
            <li>Add multiple sample variations using the <strong>+</strong> button for natural letterform variance.</li>
            <li>Samples are stored locally in your browser's IndexedDB.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
