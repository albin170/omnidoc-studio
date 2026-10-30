import React, { useEffect, useState } from 'react';
import { 
  ConversionHistoryItem, 
  ConversionJob, 
  FileFormat, 
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
import { Modals } from './components/common/Modals';
import { UserPanel } from './components/user/UserPanel';
import { AuthGateway } from './components/auth/AuthGateway';
import { CommandPalette } from './components/common/CommandPalette';
import { GlobalDropzone } from './components/common/GlobalDropzone';
import { HelpShortcutsModal } from './components/common/HelpShortcutsModal';
import { detectFileFormat, FORMAT_REGISTRY, formatFileSize } from './services/formatDetector';
import { 
  Menu, 
  ShieldCheck, 
  User as UserIcon, 
  ChevronLeft, 
  Search, 
  HelpCircle, 
  Layers,
  ArrowLeft
} from 'lucide-react';
import { OmniDocLogo } from './components/common/OmniDocLogo';
import { useToast } from './services/toastService';

export const App: React.FC = () => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [userSession, setUserSessionState] = useState<UserSession>(getUserSession());
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);
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

  // Load projects & history on mount
  const refreshStorageData = () => {
    setProjects(getStoredProjects());
    setHistory(getConversionHistory());
  };

  useEffect(() => {
    refreshStorageData();
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K for search, Ctrl+D for dashboard, ? for help)
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
  }, []);

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
  const handleOpenFileInEditor = (file: File, format: FileFormat, targetTab?: WorkspaceTab) => {
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

    if (format === 'pdf') {
      setCurrentPdfFile(file);
      setActiveTab('pdf');
      addToast('info', 'PDF Studio Opened', file.name);
    } else if (format === 'docx' || format === 'txt' || format === 'md' || format === 'html') {
      setDocxState({
        title: file.name.replace(/\.[^/.]+$/, ''),
        content: '',
      });
      setActiveTab('docx');
      addToast('info', 'Word Document Studio Opened', file.name);
    } else if (format === 'pptx') {
      setSlideState({
        title: file.name.replace(/\.[^/.]+$/, ''),
      });
      setActiveTab('slides');
      addToast('info', 'PowerPoint Studio Opened', file.name);
    } else if (format === 'xlsx' || format === 'csv') {
      setSheetState({
        title: file.name.replace(/\.[^/.]+$/, ''),
      });
      setActiveTab('sheets');
      addToast('info', 'Spreadsheet Studio Opened', file.name);
    } else if (format === 'png' || format === 'jpg' || format === 'webp') {
      setCurrentImageFile(file);
      setActiveTab('image');
      addToast('info', 'Photo & Graphics Studio Opened', file.name);
    } else {
      handleSendToConverter([file]);
    }
  };

  // Send files into Conversion Hub queue with error validation
  const handleSendToConverter = (files: File[]) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (const f of files) {
      if (f.size === 0) {
        addToast('error', 'Empty File Skipped', `"${f.name}" is 0 bytes.`);
        continue;
      }
      if (f.size > 100 * 1024 * 1024) {
        addToast('warning', 'File Skipped', `"${f.name}" exceeds the 100MB limit.`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    const newJobs: ConversionJob[] = validFiles.map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() as FileFormat;
      const sourceFmt = FORMAT_REGISTRY[ext] ? ext : 'pdf';
      const allowed = FORMAT_REGISTRY[sourceFmt]?.allowedConversions || ['pdf'];

      return {
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceFile: file,
        sourceFormat: sourceFmt,
        targetFormat: allowed[0] || 'pdf',
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
      const format = await detectFileFormat(file);
      if (format) {
        handleOpenFileInEditor(file, format);
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

  // Save current project from editor
  const handleSaveProject = (title: string, data: any, type: StoredProject['type']) => {
    try {
      const newProject: StoredProject = {
        id: `proj-${Date.now()}`,
        title: title || 'Untitled Project',
        type,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        sizeBytes: JSON.stringify(data).length,
        data,
      };

      saveProject(newProject);
      refreshStorageData();
      addToast('success', 'Project Saved', `"${title}" has been saved locally.`);
    } catch (err: any) {
      addToast('error', 'Save Failed', err.message || 'Could not save project to local storage.');
    }
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
      setSheetState({
        title: proj.title,
        data: proj.data?.gridData,
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
    deleteProject(id);
    refreshStorageData();
    addToast('warning', 'Project Deleted', 'Project removed from storage.');
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
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenUserPanel={() => setIsUserPanelOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelp={() => setIsHelpShortcutsOpen(true)}
        onLogout={handleLogout}
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
              </select>

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
          <ProjectsManager
            projects={projects}
            history={history}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onRefreshData={refreshStorageData}
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
