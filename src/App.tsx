import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ConversionHistoryItem, 
  ConversionJob, 
  FileFormat, 
  SlideItem,
  StoredProject, 
  TemplateItem, 
  WorkspaceTab 
} from './types';
import { 
  deleteProject, 
  getConversionHistory, 
  getStoredProjects, 
  getUserSession, 
  logoutUser, 
  saveProject, 
  setUserSession, 
  UserSession 
} from './services/storageService';
import { Sidebar } from './components/common/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ConversionHub } from './components/converter/ConversionHub';
import { PdfStudio } from './components/pdf/PdfStudio';
import { DocxStudio } from './components/docx/DocxStudio';
import { SlideStudio } from './components/slides/SlideStudio';
import { SheetStudio } from './components/sheets/SheetStudio';
import { ImageStudio } from './components/image/ImageStudio';
import { OcrStudio } from './components/ocr/OcrStudio';
import { TemplatesHub } from './components/templates/TemplatesHub';
import { ProjectsManager } from './components/projects/ProjectsManager';
import { SettingsHub } from './components/settings/SettingsHub';
import { AdminConsole } from './components/admin/AdminConsole';
import { Modals } from './components/common/Modals';
import { UserPanel } from './components/user/UserPanel';
import { AuthGateway } from './components/auth/AuthGateway';
import { CommandPalette } from './components/common/CommandPalette';
import { GlobalDropzone } from './components/common/GlobalDropzone';
import { HelpShortcutsModal } from './components/common/HelpShortcutsModal';
import { FORMAT_REGISTRY, formatFileSize, validateFileFormat } from './services/formatDetector';
import { extractTextFromDocxFile } from './services/docxService';
import { parseSpreadsheetFile } from './services/sheetService';
import { extractTextFromPptxFile } from './services/pptxService';
import { DocumentDiffModal } from './components/diff/DocumentDiffModal';
import { BatchAutomationModal } from './components/converter/BatchAutomationModal';
import { AiAssistantDrawer } from './components/ai/AiAssistantDrawer';
import { 
  Menu, 
  User as UserIcon, 
  Search, 
  HelpCircle, 
  ArrowLeft,
  Sparkles,
  GitCompare,
  Layers
} from 'lucide-react';
import { OmniDocLogo } from './components/common/OmniDocLogo';
import { useToast } from './services/toastService';

export const App: React.FC = () => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [userSession, setUserSessionState] = useState<UserSession>(getUserSession());
  const [projects, setProjects] = useState<StoredProject[]>(() => getStoredProjects());
  const [history, setHistory] = useState<ConversionHistoryItem[]>(() => getConversionHistory());
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpShortcutsOpen, setIsHelpShortcutsOpen] = useState(false);

  // Workspace-specific state passed from dashboard/templates
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  const [docxState, setDocxState] = useState<{ title: string; content: string }>({
    title: 'Executive Project Scope',
    content: '',
  });
  const [slideState, setSlideState] = useState<{ title: string; slides?: any[] }>({
    title: 'Strategic Presentation Deck',
  });
  const [sheetState, setSheetState] = useState<{ title: string; data?: any[][] }>({
    title: 'Financial Analysis & Budget',
  });

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Extract current document content for AI Assistant & Revision Diff
  const currentDocumentContent = useMemo(() => {
    if (activeTab === 'docx') return docxState.content;
    if (activeTab === 'slides') {
      return (
        slideState.slides
          ?.map(
            (s: any) =>
              s.title + '\n' + (s.elements?.map((e: any) => e.content).join('\n') || '')
          )
          .join('\n\n') || ''
      );
    }
    if (activeTab === 'sheets') {
      return sheetState.data?.map((row) => row.join(', ')).join('\n') || '';
    }
    return '';
  }, [activeTab, docxState.content, slideState.slides, sheetState.data]);

  const currentDocumentTitle = useMemo(() => {
    if (activeTab === 'docx') return docxState.title;
    if (activeTab === 'slides') return slideState.title;
    if (activeTab === 'sheets') return sheetState.title;
    return 'Active Document';
  }, [activeTab, docxState.title, slideState.title, sheetState.title]);

  // Load projects & history on mount
  const refreshStorageData = () => {
    setProjects(getStoredProjects());
    setHistory(getConversionHistory());
  };

  // Save current project from editor
  const handleSaveProject = useCallback((title: string, data: any, type: StoredProject['type']) => {
    try {
      let normalizedData = data;
      if (type === 'sheets') {
        const gridData = data?.gridData || data?.data || (Array.isArray(data) ? data : undefined);
        normalizedData = { gridData, data: gridData };
      }

      const newProject: StoredProject = {
        id: `proj-${Date.now()}`,
        title: title || 'Untitled Project',
        type,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        sizeBytes: JSON.stringify(normalizedData).length,
        data: normalizedData,
      };

      saveProject(newProject);
      refreshStorageData();
      addToast('success', 'Project Saved', `"${title}" has been saved locally.`);
    } catch (err: any) {
      addToast('error', 'Save Failed', err.message || 'Could not save project to local storage.');
    }
  }, [addToast]);

  // Global Keyboard Shortcuts (Ctrl+K for search, Ctrl+D for dashboard, Ctrl+S for save, ? for help)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Quick return to Dashboard with Ctrl+D or Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setActiveTab('dashboard');
        return;
      }

      // Quick save current workspace project with Ctrl+S or Cmd+S (BUG-005 fix)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        switch (activeTab) {
          case 'docx':
            handleSaveProject(docxState.title, { content: docxState.content }, 'docx');
            break;
          case 'slides':
            handleSaveProject(slideState.title, { slides: slideState.slides }, 'slides');
            break;
          case 'sheets':
            handleSaveProject(sheetState.title, { gridData: sheetState.data }, 'sheets');
            break;
          case 'pdf':
            addToast('info', 'Save PDF', 'Use the Save button in the PDF Studio toolbar to save page annotations.');
            break;
          case 'image':
            addToast('info', 'Save Graphics', 'Use the Save button in the Graphics Studio toolbar.');
            break;
          default:
            addToast('info', 'Studio Workspace', 'All changes and conversions are saved directly to local memory.');
            break;
        }
        return;
      }

      // Open Help on '?' if user is not actively typing in an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsHelpShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, docxState, slideState, sheetState, handleSaveProject, addToast]);

  const handleUpdateSession = (newSession: UserSession) => {
    setUserSessionState(newSession);
    setUserSession(newSession);
  };

  const handleLogout = () => {
    const loggedOut = logoutUser();
    setUserSessionState(loggedOut);
    addToast('info', 'Logged Out', 'You have been logged out. See you next time!');
  };

  // Dispatch uploaded file to corresponding editor with robust error checks
  const handleOpenFileInEditor = async (file: File, format: FileFormat, targetTab?: WorkspaceTab) => {
    if (!file || file.size === 0) {
      addToast('error', 'Invalid File', 'The selected file is empty (0 bytes).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      addToast('warning', 'File Too Large', `File size (${formatFileSize(file.size)}) exceeds 100MB memory limit.`);
      return;
    }

    if (targetTab) {
      setActiveTab(targetTab);
      return;
    }

    // Validate file integrity and content signatures
    const validation = await validateFileFormat(file);
    if (!validation.valid) {
      addToast('error', 'File Validation Failed', validation.error || `"${file.name}" is corrupted or unsupported.`);
      return;
    }

    const effectiveFormat = validation.format || format;

    if (effectiveFormat === 'pdf') {
      setCurrentPdfFile(file);
      setActiveTab('pdf');
      addToast('info', 'PDF Studio Opened', file.name);
    } else if (effectiveFormat === 'docx') {
      try {
        const text = await extractTextFromDocxFile(file);
        setDocxState({
          title: file.name.replace(/\.[^/.]+$/, ''),
          content: text,
        });
        setActiveTab('docx');
        addToast('info', 'Word Document Studio Opened', file.name);
      } catch (err: any) {
        addToast('error', 'Failed to Open DOCX', err.message || 'Could not parse document XML.');
      }
    } else if (effectiveFormat === 'txt' || effectiveFormat === 'md' || effectiveFormat === 'html') {
      try {
        const text = await file.text();
        setDocxState({
          title: file.name.replace(/\.[^/.]+$/, ''),
          content: text,
        });
        setActiveTab('docx');
        addToast('info', 'Document Opened', file.name);
      } catch (err: any) {
        addToast('error', 'Failed to Open Text File', err.message || 'Unreadable text content.');
      }
    } else if (effectiveFormat === 'pptx') {
      try {
        const slideTexts = await extractTextFromPptxFile(file);
        const parsedSlides: SlideItem[] = slideTexts.map((text, idx) => {
          const lines = text.split('\n').filter(Boolean);
          const title = lines[0] || `Slide ${idx + 1}`;
          const body = lines.slice(1).join('\n') || '';
          return {
            id: `slide-${Date.now()}-${idx}`,
            title,
            bgColor: idx === 0 ? '#0f172a' : '#1e1b4b',
            layout: idx === 0 ? 'title' : 'content',
            elements: [
              {
                id: `el-title-${idx}`,
                type: 'title',
                content: title,
                x: 10,
                y: idx === 0 ? 25 : 10,
                width: 80,
                height: 20,
                fontSize: idx === 0 ? 40 : 28,
                fontColor: '#ffffff',
              },
              ...(body
                ? [
                    {
                      id: `el-body-${idx}`,
                      type: 'text' as const,
                      content: body,
                      x: 10,
                      y: idx === 0 ? 55 : 35,
                      width: 80,
                      height: 50,
                      fontSize: 16,
                      fontColor: '#cbd5e1',
                    },
                  ]
                : []),
            ],
          };
        });

        setSlideState({
          title: file.name.replace(/\.[^/.]+$/, ''),
          slides: parsedSlides,
        });
        setActiveTab('slides');
        addToast('info', 'PowerPoint Studio Opened', file.name);
      } catch (err: any) {
        addToast('error', 'Failed to Open PPTX', err.message || 'Could not parse presentation slides.');
      }
    } else if (effectiveFormat === 'xlsx' || effectiveFormat === 'csv') {
      try {
        const parsed = await parseSpreadsheetFile(file);
        setSheetState({
          title: file.name.replace(/\.[^/.]+$/, ''),
          data: parsed.data,
        });
        setActiveTab('sheets');
        addToast('info', 'Spreadsheet Studio Opened', file.name);
      } catch (err: any) {
        addToast('error', 'Failed to Open Spreadsheet', err.message || 'Could not parse spreadsheet data.');
      }
    } else if (effectiveFormat === 'png' || effectiveFormat === 'jpg' || effectiveFormat === 'webp') {
      setCurrentImageFile(file);
      setActiveTab('image');
      addToast('info', 'Photo & Graphics Studio Opened', file.name);
    } else {
      handleSendToConverter([file]);
    }
  };

  // Send files into Conversion Hub queue with error validation
  const handleSendToConverter = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const validFiles: { file: File; format: FileFormat }[] = [];
    for (const f of files) {
      if (f.size === 0) {
        addToast('error', 'Empty File Skipped', `"${f.name}" is 0 bytes.`);
        continue;
      }
      if (f.size > 100 * 1024 * 1024) {
        addToast('warning', 'File Skipped', `"${f.name}" exceeds the 100MB limit.`);
        continue;
      }
      const validation = await validateFileFormat(f);
      if (!validation.valid || !validation.format) {
        addToast('error', 'Unsupported or Corrupt File', validation.error || `"${f.name}" could not be identified.`);
        continue;
      }
      validFiles.push({ file: f, format: validation.format });
    }

    if (validFiles.length === 0) return;

    const newJobs: ConversionJob[] = validFiles.map(({ file, format }) => {
      const allowed = FORMAT_REGISTRY[format]?.allowedConversions || [];
      const targetFormat = allowed[0] || (format === 'pdf' ? 'txt' : 'pdf');

      return {
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceFile: file,
        sourceFormat: format,
        targetFormat,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
      };
    });

    setJobs((prev) => [...prev, ...newJobs]);
    setActiveTab('converter');
    addToast('success', 'Files Added to Queue', `${validFiles.length} file(s) queued for conversion.`);
  };

  // Global window drag-and-drop drop handler
  const handleGlobalFilesDropped = async (files: File[]) => {
    if (files.length === 1) {
      const file = files[0];
      const validation = await validateFileFormat(file);
      if (validation.valid && validation.format) {
        handleOpenFileInEditor(file, validation.format);
      } else {
        handleSendToConverter([file]);
      }
    } else if (files.length > 1) {
      handleSendToConverter(files);
    }
  };

  // Boot template into workspace
  const handleSelectTemplate = (template: TemplateItem) => {
    if (template.targetWorkspace === 'docx') {
      setDocxState({
        title: template.payload.title,
        content: template.payload.content,
      });
      setActiveTab('docx');
    } else if (template.targetWorkspace === 'slides') {
      setSlideState({
        title: template.payload.title,
        slides: template.payload.slides,
      });
      setActiveTab('slides');
    } else if (template.targetWorkspace === 'sheets') {
      setSheetState({
        title: template.title,
        data: template.payload.data,
      });
      setActiveTab('sheets');
    } else if (template.targetWorkspace === 'image') {
      setActiveTab('image');
    } else {
      setActiveTab(template.targetWorkspace);
    }
    addToast('info', 'Template Loaded', template.title);
  };

  // Load past project
  const handleLoadProject = (proj: StoredProject) => {
    if (proj.type === 'docx') {
      setDocxState({
        title: proj.title,
        content: proj.data?.content || '',
      });
      setActiveTab('docx');
    } else if (proj.type === 'slides') {
      setSlideState({
        title: proj.title,
        slides: proj.data?.slides,
      });
      setActiveTab('slides');
    } else if (proj.type === 'sheets') {
      const grid = proj.data?.gridData || proj.data?.data || (Array.isArray(proj.data) ? proj.data : undefined);
      setSheetState({
        title: proj.title,
        data: grid,
      });
      setActiveTab('sheets');
    } else if (proj.type === 'pdf') {
      setActiveTab('pdf');
    } else if (proj.type === 'image') {
      setActiveTab('image');
    }
    addToast('info', 'Project Opened', proj.title);
  };

  // Delete project
  const handleDeleteProject = (id: string) => {
    try {
      deleteProject(id);
      refreshStorageData();
      addToast('warning', 'Project Deleted', 'Project removed from storage.');
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message || 'Could not delete project from storage.');
    }
  };

  const totalStorageBytes = projects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);

  // Friendly human readable tab names
  const studioTitles: Record<WorkspaceTab, string> = {
    dashboard: 'Workspace Dashboard',
    converter: 'Universal Conversion Hub',
    pdf: 'PDF Studio & Signatures',
    docx: 'Word Document Editor (DOCX)',
    slides: 'PowerPoint Studio (PPTX)',
    sheets: 'Spreadsheet Grid (XLSX/CSV)',
    image: 'Photo & Graphic Studio',
    ocr: 'Optical Character Recognition (OCR)',
    templates: 'Starter Templates Gallery',
    projects: 'Projects & Conversion History',
    settings: 'Settings & Security',
    admin: 'Admin & Telemetry Console',
  };

  // If user is unauthenticated (first-time visitor or logged out), render the Auth Gateway!
  // Once authenticated (or for returning visitors with saved session), enter directly!
  if (!userSession.isAuthenticated) {
    return (
      <AuthGateway
        onAuthenticate={(session) => {
          handleUpdateSession(session);
        }}
      />
    );
  }

  return (
    /* Full-Screen, 100% Viewport App Shell */
    <div className="w-full h-screen min-h-screen m-0 p-0 overflow-hidden flex flex-col md:flex-row bg-slate-100/70 select-none relative">
      {/* Global Window Drag-and-Drop Listener */}
      <GlobalDropzone onFilesDropped={handleGlobalFilesDropped} />

      {/* Mobile Top Header (hidden on desktop) */}
      <header className="w-full md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white z-30 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <OmniDocLogo size={32} />
          <div className="font-extrabold text-sm text-white">OmniDoc Studio</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsUserPanelOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
            title="User Panel"
          >
            <UserIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Full-Height Left Navy Glass Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        conversionCount={jobs.length}
        projectCount={projects.length}
        userName={userSession.userName || 'Document Architect'}
        avatarUrl={userSession.avatarUrl}
        userRole={userSession.role || 'admin'}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenUserPanel={() => setIsUserPanelOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelp={() => setIsHelpShortcutsOpen(true)}
        onLogout={handleLogout}
        onOpenDiff={() => setIsDiffOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
      />

      {/* Full-Size Dynamic Workspace Content Area */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-white/75 backdrop-blur-xl">
        {/* User-Friendly Studio Navigation & Quick Switcher Breadcrumb (shown in active studios) */}
        {activeTab !== 'dashboard' && (
          <div className="h-12 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-10">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                title="Return to Dashboard (Ctrl+D)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <span className="text-slate-300 font-light">/</span>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  {studioTitles[activeTab]}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>
            </div>

            {/* Right Tools in Studio Bar */}
            <div className="flex items-center gap-2">
              {/* Studio Quick Switcher Dropdown */}
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as WorkspaceTab)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border-none text-[11px] font-semibold text-slate-700 outline-none cursor-pointer hidden sm:block"
                title="Quick switch to another studio"
              >
                <option value="dashboard">Dashboard</option>
                <option value="converter">Conversion Hub</option>
                <option value="pdf">PDF Studio</option>
                <option value="docx">Word (DOCX)</option>
                <option value="slides">PowerPoint (PPTX)</option>
                <option value="sheets">Sheets (XLSX)</option>
                <option value="image">Photo &amp; Graphics</option>
                <option value="ocr">OCR Scanner</option>
                <option value="templates">Templates</option>
                <option value="projects">Projects</option>
                <option value="settings">Settings &amp; Environment</option>
                {userSession.role === 'admin' && (
                  <option value="admin">Admin Console</option>
                )}
              </select>

              <button
                onClick={() => setIsAiOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 cursor-pointer"
                title="AI Document Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden md:inline">AI Help</span>
              </button>

              <button
                onClick={() => setIsDiffOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 cursor-pointer"
                title="Compare Revisions & View Diffs"
              >
                <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">Compare</span>
              </button>

              <button
                onClick={() => setIsBatchOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 cursor-pointer"
                title="Batch Convert & ZIP Automation"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">Batch ZIP</span>
              </button>

              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                title="Quick Search (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsHelpShortcutsOpen(true)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                title="Shortcuts & Help (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <Dashboard
            onOpenFileInEditor={handleOpenFileInEditor}
            onSendToConverter={handleSendToConverter}
            setActiveTab={setActiveTab}
            recentProjects={projects}
            conversionHistory={history}
            queueCount={jobs.length}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            userName={userSession.userName || 'Document Architect'}
            avatarUrl={userSession.avatarUrl}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenUserPanel={() => setIsUserPanelOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        )}

        {activeTab === 'converter' && (
          <ConversionHub
            jobs={jobs}
            setJobs={setJobs}
            onAddFiles={handleSendToConverter}
            onConversionCompleted={refreshStorageData}
          />
        )}

        {activeTab === 'pdf' && (
          <PdfStudio
            initialFile={currentPdfFile}
            onSaveToProjects={(title, data) => handleSaveProject(title, data, 'pdf')}
          />
        )}

        {activeTab === 'docx' && (
          <DocxStudio
            initialTitle={docxState.title}
            initialContent={docxState.content}
            onSaveToProjects={(title, data) => handleSaveProject(title, data, 'docx')}
          />
        )}

        {activeTab === 'slides' && (
          <SlideStudio
            initialTitle={slideState.title}
            initialSlides={slideState.slides}
            onSaveToProjects={(title, data) => handleSaveProject(title, data, 'slides')}
          />
        )}

        {activeTab === 'sheets' && (
          <SheetStudio
            initialTitle={sheetState.title}
            initialData={sheetState.data}
            onSaveToProjects={(title, data) => handleSaveProject(title, data, 'sheets')}
          />
        )}

        {activeTab === 'image' && (
          <ImageStudio
            initialFile={currentImageFile}
            onSaveToProjects={(title, data) => handleSaveProject(title, data, 'image')}
          />
        )}

        {activeTab === 'ocr' && (
          <OcrStudio
            onSendToWordEditor={(text, title) => {
              setDocxState({ title, content: text });
              setActiveTab('docx');
            }}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesHub onSelectTemplate={handleSelectTemplate} />
        )}

        {activeTab === 'projects' && (
          <ProjectsManager
            projects={projects}
            history={history}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onRefreshData={refreshStorageData}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsHub
            totalStorageBytes={totalStorageBytes}
            totalProjectsCount={projects.length}
            onRefreshData={refreshStorageData}
          />
        )}

        {activeTab === 'admin' && (
          <AdminConsole
            userSession={userSession}
            onUpdateSession={handleUpdateSession}
            totalStorageBytes={totalStorageBytes}
          />
        )}
      </main>

      {/* User & Billing Panel */}
      <UserPanel
        isOpen={isUserPanelOpen}
        onClose={() => setIsUserPanelOpen(false)}
        userSession={userSession}
        onUpdateSession={handleUpdateSession}
        totalStorageBytes={totalStorageBytes}
        totalProjectsCount={projects.length}
        onLogout={handleLogout}
      />

      {/* Interactive Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        onNewDocx={() => {
          setDocxState({ title: 'Untitled Document', content: '' });
          setActiveTab('docx');
        }}
        onNewSlides={() => {
          setSlideState({ title: 'Untitled Presentation' });
          setActiveTab('slides');
        }}
        onNewSheet={() => {
          setSheetState({ title: 'Untitled Spreadsheet' });
          setActiveTab('sheets');
        }}
        onOpenHelp={() => setIsHelpShortcutsOpen(true)}
      />

      {/* OmniDoc v2.0 Platform Modals */}
      <DocumentDiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        defaultOldText={currentDocumentContent}
        defaultOldTitle={currentDocumentTitle}
      />

      <BatchAutomationModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
      />

      <AiAssistantDrawer
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        documentContent={currentDocumentContent}
        documentTitle={currentDocumentTitle}
      />

      {/* Keyboard Shortcuts & Help Modal */}
      <HelpShortcutsModal
        isOpen={isHelpShortcutsOpen}
        onClose={() => setIsHelpShortcutsOpen(false)}
      />

      {/* Global Modals */}
      <Modals
        isAuthOpen={isAuthOpen}
        onCloseAuth={() => setIsAuthOpen(false)}
        userSession={userSession}
        onUpdateSession={handleUpdateSession}
        isSettingsOpen={isSettingsOpen}
        onCloseSettings={() => setIsSettingsOpen(false)}
        isHelpOpen={isHelpOpen}
        onCloseHelp={() => setIsHelpOpen(false)}
      />
    </div>
  );
};

export default App;
