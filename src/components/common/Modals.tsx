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
        <div className="fixed inset-0 z-50 bg-[#03050C]/90 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="lg-liquid-5 border border-white/20 rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#F5FAFF] font-bold text-base font-display">
                <User className="w-5 h-5 text-[#38BDF8]" />
                <span>Account &amp; Storage Profile</span>
              </div>
              <button onClick={onCloseAuth} className="text-[#A7B8CA] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl lg-secondary border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] text-white flex items-center justify-center font-bold">
                  {userSession.isGuest ? 'G' : (nameInput[0]?.toUpperCase() || 'U')}
                </div>
                <div>
                  <div className="font-semibold text-[#F5FAFF]">
                    {userSession.isGuest ? 'Anonymous Guest Session' : nameInput}
                  </div>
                  <div className="text-[10px] text-[#A7B8CA]">
                    {userSession.isGuest ? 'Session-isolated offline storage' : emailInput || 'Local profile'}
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A7B8CA] font-semibold block mb-1">Your Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full lg-input text-xs"
                />
              </div>

              <div>
                <label className="text-[#A7B8CA] font-semibold block mb-1">Email (Optional for exports)</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full lg-input text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <button
                onClick={handleSwitchGuest}
                className="text-xs text-[#A7B8CA] hover:text-[#38BDF8] transition-colors cursor-pointer"
              >
                Use Anonymous Mode
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onCloseAuth}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#A7B8CA] hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAuth}
                  className="px-4 py-1.5 rounded-xl lg-btn-primary text-xs font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#03050C]/90 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="lg-liquid-5 border border-white/20 rounded-[24px] max-w-lg w-full p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#F5FAFF] font-bold text-base font-display">
                <Settings className="w-5 h-5 text-[#38BDF8]" />
                <span>Application Settings</span>
              </div>
              <button onClick={onCloseSettings} className="text-[#A7B8CA] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#A7B8CA]">
              <div className="flex items-center justify-between p-3 rounded-xl lg-secondary border border-white/10">
                <div>
                  <div className="font-semibold text-[#F5FAFF]">Default PDF Page Layout</div>
                  <div className="text-[11px] text-[#A7B8CA]">Standard ISO A4 (595 x 842 pt)</div>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white/10 text-[#F5FAFF] font-mono text-[10px]">
                  A4
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl lg-secondary border border-white/10">
                <div>
                  <div className="font-semibold text-[#F5FAFF]">Presentation Aspect Ratio</div>
                  <div className="text-[11px] text-[#A7B8CA]">Widescreen 16:9 for modern displays</div>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white/10 text-[#F5FAFF] font-mono text-[10px]">
                  16:9
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl lg-secondary border border-white/10">
                <div>
                  <div className="font-semibold text-[#F5FAFF]">Local Privacy Sandbox</div>
                  <div className="text-[11px] text-[#A7B8CA]">Process files in WebAssembly &amp; Memory</div>
                </div>
                <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px]">
                  ENFORCED
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={onCloseSettings}
                className="px-5 py-2 rounded-xl lg-btn-primary text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Help & Shortcuts Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-[#03050C]/90 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="lg-liquid-5 border border-white/20 rounded-[24px] max-w-xl w-full p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#F5FAFF] font-bold text-base font-display">
                <HelpCircle className="w-5 h-5 text-[#38BDF8]" />
                <span>OmniDoc Studio Documentation</span>
              </div>
              <button onClick={onCloseHelp} className="text-[#A7B8CA] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#A7B8CA]">
              <div className="space-y-2">
                <h4 className="font-bold text-[#F5FAFF] uppercase text-[11px] tracking-wider text-[#38BDF8] font-display">
                  Supported File Conversions
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-rose-400">PDF</strong> → DOCX, TXT, PNG, JPG
                  </div>
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-sky-400">DOCX</strong> → PDF, TXT, HTML
                  </div>
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-amber-400">PPTX</strong> → PDF, PNG
                  </div>
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-emerald-400">XLSX / CSV</strong> → PDF, CSV, XLSX
                  </div>
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-[#FF3366]">PNG / JPG / WebP</strong> → PDF, Formats
                  </div>
                  <div className="p-2.5 rounded-xl lg-secondary border border-white/10">
                    <strong className="text-[#38BDF8]">OCR Scans</strong> → Searchable PDF, DOCX, TXT
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <h4 className="font-bold text-[#F5FAFF] uppercase text-[11px] tracking-wider text-[#38BDF8] font-display">
                  Spreadsheet Formulas Supported
                </h4>
                <p className="text-[#A7B8CA] leading-relaxed text-[11px]">
                  Enter standard uppercase formulas in the formula bar:
                  <br />
                  <code className="text-[#38BDF8] font-mono">=SUM(A1:A5)</code>,{' '}
                  <code className="text-[#38BDF8] font-mono">=AVERAGE(B2:E2)</code>,{' '}
                  <code className="text-[#38BDF8] font-mono">=MIN(A1:B3)</code>,{' '}
                  <code className="text-[#38BDF8] font-mono">=MAX(A1:B3)</code>,{' '}
                  <code className="text-[#38BDF8] font-mono">=COUNT(A1:A10)</code>, or simple math{' '}
                  <code className="text-[#38BDF8] font-mono">=(A1+B1)*2</code>.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <h4 className="font-bold text-[#F5FAFF] uppercase text-[11px] tracking-wider text-[#FF3366] font-display">
                  Privacy-First Guarantee
                </h4>
                <p className="text-[#A7B8CA] leading-relaxed text-[11px]">
                  All processing runs directly inside your browser. No files are transmitted to external servers without explicit consent.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={onCloseHelp}
                className="px-5 py-2 rounded-xl lg-btn-primary text-xs font-semibold cursor-pointer"
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
