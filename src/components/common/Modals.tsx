import React, { useState } from 'react';
import { 
  X, 
  User, 
  Settings, 
  HelpCircle, 
  ShieldCheck, 
  HardDrive, 
  Command, 
  FileText, 
  Key, 
  CheckCircle2,
  FileCode
} from 'lucide-react';
import { UserSession } from '../../services/storageService';

interface ModalsProps {
  isAuthOpen: boolean;
  onCloseAuth: () => void;
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;

  isSettingsOpen: boolean;
  onCloseSettings: () => void;

  isHelpOpen: boolean;
  onCloseHelp: () => void;
}

export const Modals: React.FC<ModalsProps> = ({
  isAuthOpen,
  onCloseAuth,
  userSession,
  onUpdateSession,
  isSettingsOpen,
  onCloseSettings,
  isHelpOpen,
  onCloseHelp,
}) => {
  const [nameInput, setNameInput] = useState(userSession.userName || 'Guest User');
  const [emailInput, setEmailInput] = useState(userSession.userEmail || '');

  const handleSaveAuth = () => {
    onUpdateSession({
      ...userSession,
      isGuest: false,
      userName: nameInput,
      userEmail: emailInput,
    });
    onCloseAuth();
  };

  const handleSwitchGuest = () => {
    onUpdateSession({
      isGuest: true,
      userName: 'Guest User',
      storageUsedBytes: userSession.storageUsedBytes,
    });
    onCloseAuth();
  };

  return (
    <>
      {/* 1. Account / Auth Modal */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <User className="w-5 h-5 text-indigo-400" />
                <span>Account &amp; Storage Profile</span>
              </div>
              <button onClick={onCloseAuth} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  {userSession.isGuest ? 'G' : (nameInput[0]?.toUpperCase() || 'U')}
                </div>
                <div>
                  <div className="font-semibold text-slate-200">
                    {userSession.isGuest ? 'Anonymous Guest Session' : nameInput}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {userSession.isGuest ? 'Session-isolated offline storage' : emailInput || 'Local profile'}
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Your Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Email (Optional for exports)</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleSwitchGuest}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Use Anonymous Mode
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onCloseAuth}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAuth}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Settings className="w-5 h-5 text-indigo-400" />
                <span>Application Settings</span>
              </div>
              <button onClick={onCloseSettings} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Default PDF Page Layout</div>
                  <div className="text-[11px] text-slate-500">Standard ISO A4 (595 x 842 pt)</div>
                </div>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                  A4
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Presentation Aspect Ratio</div>
                  <div className="text-[11px] text-slate-500">Widescreen 16:9 for modern displays</div>
                </div>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                  16:9
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Local Privacy Sandbox</div>
                  <div className="text-[11px] text-slate-500">Process files in WebAssembly &amp; Memory</div>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                  ENFORCED
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onCloseSettings}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Help & Shortcuts Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <span>OmniDoc Studio Documentation</span>
              </div>
              <button onClick={onCloseHelp} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="space-y-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-indigo-400">
                  Supported File Conversions
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-red-400">PDF</strong> → DOCX, TXT, PNG, JPG
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-blue-400">DOCX</strong> → PDF, TXT, HTML
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-amber-400">PPTX</strong> → PDF, PNG
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-emerald-400">XLSX / CSV</strong> → PDF, CSV, XLSX
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-purple-400">PNG / JPG / WebP</strong> → PDF, Formats
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <strong className="text-cyan-400">OCR Scans</strong> → Searchable PDF, DOCX, TXT
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-indigo-400">
                  Spreadsheet Formulas Supported
                </h4>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Enter standard uppercase formulas in the formula bar:
                  <br />
                  <code className="text-indigo-300 font-mono">=SUM(A1:A5)</code>,{' '}
                  <code className="text-indigo-300 font-mono">=AVERAGE(B2:E2)</code>,{' '}
                  <code className="text-indigo-300 font-mono">=MIN(A1:B3)</code>,{' '}
                  <code className="text-indigo-300 font-mono">=MAX(A1:B3)</code>,{' '}
                  <code className="text-indigo-300 font-mono">=COUNT(A1:A10)</code>, or simple math{' '}
                  <code className="text-indigo-300 font-mono">=(A1+B1)*2</code>.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-indigo-400">
                  Privacy-First Guarantee
                </h4>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  All processing runs directly inside your browser. No files are transmitted to external servers without explicit consent.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onCloseHelp}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
