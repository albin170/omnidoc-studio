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
import { PricingPage } from './components/pricing/PricingPage';
import { omniDocClient } from './sdk/omnidocClient';
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
import { VisualWorkflowStudio } from './components/workflow/VisualWorkflowStudio';
import { DocumentForensicsModal } from './components/forensics/DocumentForensicsModal';
import { DataLineageModal } from './components/lineage/DataLineageModal';
import { TransformationReceiptModal } from './components/receipts/TransformationReceiptModal';
import { AutonomousWorkspace } from './components/autonomous/AutonomousWorkspace';
import { PrivacyGuardianModal } from './components/privacy/PrivacyGuardianModal';
import { DocumentWhatIfModal } from './components/simulation/DocumentWhatIfModal';
import { TeamWorkspaceModal } from './components/collaboration/TeamWorkspaceModal';
import { DeveloperApiModal } from './components/developer/DeveloperApiModal';
import { 
  Menu, 
  User as UserIcon, 
  Search, 
  HelpCircle, 
  ArrowLeft,
  Sparkles,
  GitCompare,
  Layers,
  LogOut,
  AlertTriangle,
  X,
  Bell,
  LayoutDashboard,
  RefreshCw,
  FileText,
  FolderArchive,
  ShieldAlert
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
  const [viewAsUserSession, setViewAsUserSession] = useState<{
    active: boolean;
    targetUser: any;
    sessionId: string;
    originalAdminSession?: UserSession;
  } | null>(null);
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
  const [isForensicsOpen, setIsForensicsOpen] = useState(false);
  const [isLineageOpen, setIsLineageOpen] = useState(false);
  const [isReceiptsOpen, setIsReceiptsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);

  // Dynamic UI Configuration from Backend
  const [uiConfig, setUiConfig] = useState<{
    announcement_banner?: string;
    maintenance_mode?: boolean;
    maintenance_message?: string;
    disabled_modules?: string[];
  } | null>(null);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string>(() => {
    try {
      return localStorage.getItem('omnidoc_dismissed_notice_v1') || '';
    } catch {
      return '';
    }
  });

  const isBannerDismissed = Boolean(
    uiConfig?.announcement_banner &&
    dismissedNoticeKey &&
    dismissedNoticeKey === uiConfig.announcement_banner.trim()
  );

  const handleDismissBanner = () => {
    if (uiConfig?.announcement_banner) {
      const trimmed = uiConfig.announcement_banner.trim();
      try {
        localStorage.setItem('omnidoc_dismissed_notice_v1', trimmed);
      } catch {}
      setDismissedNoticeKey(trimmed);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (userSession?.jwtToken && !userSession.isGuest) {
      omniDocClient.getUserUiConfig()
        .then((cfg) => {
          if (isMounted && cfg) {
            setUiConfig(cfg);
          }
        })
        .catch(() => {
          // Graceful non-blocking fallback for offline / guest mode
        });
    } else {
      setUiConfig(null);
    }
    return () => {
      isMounted = false;
    };
  }, [userSession?.jwtToken, userSession?.isGuest]);

  // Enforce Direct Navigation Protection for Disabled Modules
  useEffect(() => {
    if (uiConfig?.disabled_modules && uiConfig.disabled_modules.includes(activeTab)) {
      if (activeTab !== 'dashboard' && activeTab !== 'settings' && activeTab !== 'admin') {
        setActiveTab('dashboard');
        addToast('warning', 'Module Unavailable', 'The requested studio module is currently disabled by administrative policy.');
      }
    }
  }, [activeTab, uiConfig?.disabled_modules]);

  // URL Path & Hash Route Synchronization (User Portal vs Admin Portal vs Pricing)
  const initialAuthMode = useMemo<'signin' | 'signup' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes('/admin') || hash.includes('admin')) {
        return 'admin';
      }
      if (path.includes('/register') || hash.includes('register')) {
        return 'signup';
      }
    }
    return 'signin';
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash.includes('pricing') || path.includes('/pricing')) {
        setActiveTab('pricing');
      } else if ((hash.includes('admin') || path.includes('/admin')) && (userSession.role === 'admin' || userSession.role === 'superadmin')) {
        setActiveTab('admin');
      }
    }
  }, [userSession.role]);

  // Administrative tab guard: automatically redirect user or staff away from Admin Console
  useEffect(() => {
    if (activeTab === 'admin' && userSession.role !== 'admin' && userSession.role !== 'superadmin') {
      setActiveTab('dashboard');
      addToast('warning', 'Access Restricted', 'The Admin Console is reserved for verified administrators.');
    }
  }, [activeTab, userSession.role, addToast]);

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

    // Validate file integrity and content signatures first (BUG-16 Fix)
    const validation = await validateFileFormat(file);
    if (!validation.valid) {
      addToast('error', 'File Validation Failed', validation.error || `"${file.name}" is corrupted or unsupported.`);
      return;
    }

    const effectiveFormat = validation.format || format;

    // Verify targetTab compatibility if target tab explicitly requested
    if (targetTab) {
      const tabCompatMap: Record<string, FileFormat[]> = {
        pdf: ['pdf'],
        docx: ['docx', 'txt', 'md', 'html'],
        slides: ['pptx'],
        sheets: ['xlsx', 'csv'],
        image: ['png', 'jpg', 'webp'],
      };

      const allowedFormats = tabCompatMap[targetTab];
      if (allowedFormats && !allowedFormats.includes(effectiveFormat)) {
        addToast(
          'error',
          'Incompatible Studio Format',
          `Cannot open .${effectiveFormat} document in ${studioTitles[targetTab] || targetTab}. Please use the Universal Conversion Hub or the appropriate studio.`
        );
        return;
      }
    }

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
    autonomous: 'Autonomous Document Engineering Workspace 2.0',
    workflow: 'Visual Workflow Studio',
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
    pricing: 'Plans & Subscription Pricing',
  };

  // If user is unauthenticated (first-time visitor or logged out), render the Auth Gateway!
  // Once authenticated (or for returning visitors with saved session), enter directly!
  if (!userSession.isAuthenticated) {
    return (
      <AuthGateway
        initialMode={initialAuthMode}
        onAuthenticate={(session) => {
          handleUpdateSession(session);
        }}
      />
    );
  }

  return (
    /* Full-Screen, 100% Viewport App Shell — Liquid Glass */
    <div className="w-full h-screen min-h-screen m-0 p-0 overflow-hidden flex flex-col md:flex-row bg-[#030817] text-[#F8FAFC] select-none relative font-sans">
      {/* Deep Spatial Background — Red & Blue Translucent Ambient Halos with High-Contrast Vignette */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="ambient-glow-1 absolute -top-32 -left-32 w-[580px] h-[580px] rounded-full bg-[#FF3366]/25 blur-[140px]" />
        <div className="ambient-glow-2 absolute top-1/4 -right-32 w-[600px] h-[600px] rounded-full bg-[#38BDF8]/25 blur-[150px]" />
        <div className="ambient-glow-3 absolute -bottom-32 left-1/4 w-[520px] h-[520px] rounded-full bg-[#1677FF]/20 blur-[140px]" />
        {/* Dark Obsidian Spatial Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_50%,rgba(3,8,23,0.85)_100%)] pointer-events-none" />
      </div>

      {/* Global Window Drag-and-Drop Listener */}
      <GlobalDropzone onFilesDropped={handleGlobalFilesDropped} />

      {/* Mobile Top Header (hidden on desktop) */}
      <header className="w-full md:hidden flex items-center justify-between px-4 py-3 lg-topbar text-[#F5FAFF] z-30 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <OmniDocLogo size={32} />
          <div className="font-extrabold text-sm text-[#F5FAFF] font-display">OmniDoc Studio</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-1.5 rounded-lg bg-white/10 text-slate-200 hover:text-white"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsUserPanelOpen(true)}
            className="p-1.5 rounded-lg bg-white/10 text-slate-200 hover:text-white"
            title="User Panel"
          >
            <UserIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:text-rose-100"
            title="Log Out"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-white/10 text-slate-200 hover:text-white"
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
        userRole={userSession.role || 'user'}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenUserPanel={() => setIsUserPanelOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelp={() => setIsHelpShortcutsOpen(true)}
        onLogout={handleLogout}
        onOpenDiff={() => setIsDiffOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
        onOpenForensics={() => setIsForensicsOpen(true)}
        onOpenLineage={() => setIsLineageOpen(true)}
        onOpenReceipts={() => setIsReceiptsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenWhatIf={() => setIsWhatIfOpen(true)}
        onOpenCollab={() => setIsCollabOpen(true)}
        onOpenDeveloper={() => setIsDeveloperOpen(true)}
        disabledModules={uiConfig?.disabled_modules}
      />

      {/* Full-Size Dynamic Workspace Content Area */}
      <main className="flex-1 h-full flex flex-col overflow-hidden relative z-10 bg-transparent">
        {/* Dynamic Global Administrator Announcement Banner */}
        {uiConfig?.announcement_banner && uiConfig.announcement_banner.trim() && !isBannerDismissed && (
          <div className="w-full bg-[#0c1b37]/95 backdrop-blur-2xl border-b border-[#38BDF8]/35 px-4 py-2 flex items-center justify-between text-xs text-[#F5FAFF] z-50 shadow-[0_4px_25px_rgba(0,0,0,0.6)] animate-fade-in shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-3 flex-1">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
                <span className="font-extrabold text-[#38BDF8] uppercase tracking-wider text-[10px] font-display">
                  Notice
                </span>
              </div>
              <span className="text-xs text-[#F5FAFF] font-medium leading-relaxed">
                {uiConfig.announcement_banner}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(userSession.role === 'admin' || userSession.role === 'superadmin') && (
                <button
                  onClick={async () => {
                    try {
                      await omniDocClient.updateAdminUiConfig({ announcement_banner: '' });
                      setUiConfig((prev) => (prev ? { ...prev, announcement_banner: '' } : null));
                      addToast('info', 'Notice Cleared', 'Global banner has been removed for all workspace users.');
                    } catch (e: any) {
                      addToast('error', 'Clear Failed', e?.message || 'Could not update UI config.');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[10px] text-[#A7B5CC] hover:text-white transition-colors cursor-pointer border border-white/10 hidden sm:inline-flex items-center gap-1"
                  title="Clear notice globally (Administrator)"
                >
                  <span>Clear Notice</span>
                </button>
              )}
              <button
                onClick={handleDismissBanner}
                className="p-1 rounded-lg hover:bg-white/10 text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
                title="Dismiss Notice"
                aria-label="Dismiss Notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Maintenance Mode Banner using Configured Message */}
        {uiConfig?.maintenance_mode && userSession.role !== 'admin' && userSession.role !== 'superadmin' && (
          <div className="w-full bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 z-50 backdrop-blur-md shrink-0 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">
                Maintenance Notice
              </span>
              <span>
                {uiConfig.maintenance_message && uiConfig.maintenance_message.trim()
                  ? uiConfig.maintenance_message
                  : 'OmniDoc Cloud is performing scheduled background updates. Local studio features remain operational.'}
              </span>
            </div>
          </div>
        )}

        {/* Admin View-As-User Persistent Banner */}
        {viewAsUserSession?.active && (
          <div className="w-full bg-amber-500/20 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 z-50 backdrop-blur-md shrink-0 shadow-lg">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold uppercase tracking-wider bg-amber-500 text-black px-2 py-0.5 rounded text-[10px]">
                Admin View Mode
              </span>
              <span>
                Viewing as <strong>{viewAsUserSession.targetUser?.full_name || viewAsUserSession.targetUser?.email}</strong> ({viewAsUserSession.targetUser?.email})
              </span>
              <span className="text-amber-300/80 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px]">
                Plan: {(viewAsUserSession.targetUser?.plan_tier || viewAsUserSession.targetUser?.plan || 'free').toUpperCase()}
              </span>
              <span className="text-amber-400 font-semibold italic text-[11px]">
                (Read-Only Simulation)
              </span>
            </div>
            <button
              onClick={async () => {
                if (viewAsUserSession.originalAdminSession?.jwtToken) {
                  omniDocClient.setToken(viewAsUserSession.originalAdminSession.jwtToken);
                }
                try {
                  await omniDocClient.exitAdminViewSession(viewAsUserSession.sessionId);
                } catch (e) {
                  console.error(e);
                }
                if (viewAsUserSession.originalAdminSession) {
                  handleUpdateSession(viewAsUserSession.originalAdminSession);
                }
                setViewAsUserSession(null);
                setActiveTab('admin');
                addToast('info', 'Exited View Mode', 'Returned to primary Administrator console with full administrative rights.');
              }}
              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors cursor-pointer"
            >
              Exit View Mode
            </button>
          </div>
        )}

        {/* User-Friendly Studio Navigation & Quick Switcher Breadcrumb (shown in active studios) */}
        {activeTab !== 'dashboard' && (
          <div className="h-12 border-b border-[rgba(255, 255, 255,0.12)] lg-topbar px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-10">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#F5FAFF] border border-[rgba(255, 255, 255,0.12)] font-bold text-xs transition-colors cursor-pointer"
                title="Return to Dashboard (Ctrl+D)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <span className="text-white/20 font-light">/</span>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#F5FAFF] font-display">
                  {studioTitles[activeTab]}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/25 text-[10px] font-bold">
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
                className="px-2.5 py-1 rounded-xl bg-[#0B1420]/90 hover:bg-[#0B1420] border border-[rgba(255, 255, 255,0.14)] text-[11px] font-semibold text-[#F5FAFF] outline-none cursor-pointer hidden sm:block backdrop-blur-md"
                title="Quick switch to another studio"
              >
                <option value="dashboard" className="bg-[#0B1420] text-white">Dashboard</option>
                <option value="autonomous" className="bg-[#0B1420] text-white">Autonomous Workspace 2.0</option>
                <option value="workflow" className="bg-[#0B1420] text-white">Workflow Studio</option>
                <option value="converter" className="bg-[#0B1420] text-white">Conversion Hub</option>
                <option value="pdf" className="bg-[#0B1420] text-white">PDF Studio</option>
                <option value="docx" className="bg-[#0B1420] text-white">Word (DOCX)</option>
                <option value="slides" className="bg-[#0B1420] text-white">PowerPoint (PPTX)</option>
                <option value="sheets" className="bg-[#0B1420] text-white">Sheets (XLSX)</option>
                <option value="image" className="bg-[#0B1420] text-white">Photo &amp; Graphics</option>
                <option value="ocr" className="bg-[#0B1420] text-white">OCR Scanner</option>
                <option value="templates" className="bg-[#0B1420] text-white">Templates</option>
                <option value="projects" className="bg-[#0B1420] text-white">Projects</option>
                <option value="pricing" className="bg-[#0B1420] text-white">Pricing &amp; Plans</option>
                <option value="settings" className="bg-[#0B1420] text-white">Settings &amp; Environment</option>
                {(userSession.role === 'admin' || userSession.role === 'superadmin') && (
                  <option value="admin" className="bg-[#11152A] text-white">Admin Console</option>
                )}
              </select>

              <button
                onClick={() => setIsAiOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#38BDF8]/12 hover:bg-[#38BDF8]/22 text-[#38BDF8] text-xs font-bold border border-[#38BDF8]/25 cursor-pointer"
                title="AI Document Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="hidden md:inline">AI Help</span>
              </button>

              <button
                onClick={() => setIsDiffOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#A7B8CA] hover:text-[#38BDF8] text-xs font-bold border border-[rgba(255, 255, 255,0.14)] cursor-pointer"
                title="Compare Revisions & View Diffs"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Compare</span>
              </button>

              <button
                onClick={() => setIsBatchOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#A7B8CA] hover:text-[#38BDF8] text-xs font-bold border border-[rgba(255, 255, 255,0.14)] cursor-pointer"
                title="Batch Convert & ZIP Automation"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Batch ZIP</span>
              </button>

              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-1.5 rounded-xl hover:bg-white/8 text-[#A7B8CA] hover:text-[#F5FAFF] cursor-pointer"
                title="Quick Search (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsHelpShortcutsOpen(true)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-[#9BA3BD] hover:text-white cursor-pointer"
                title="Shortcuts & Help (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 text-xs font-bold border border-rose-500/30 cursor-pointer transition-colors"
                title="Log Out & Switch Account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden lg:inline">Sign Out</span>
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
            onOpenForensics={() => setIsForensicsOpen(true)}
            onOpenLineage={() => setIsLineageOpen(true)}
            onOpenReceipts={() => setIsReceiptsOpen(true)}
            onOpenWhatIf={() => setIsWhatIfOpen(true)}
            onOpenCollab={() => setIsCollabOpen(true)}
            onOpenDeveloper={() => setIsDeveloperOpen(true)}
            userRole={userSession.role}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'autonomous' && (
          <AutonomousWorkspace />
        )}

        {activeTab === 'workflow' && (
          <VisualWorkflowStudio onNotify={addToast} />
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

        {activeTab === 'pricing' && (
          <PricingPage
            userSession={userSession}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsHub
            totalStorageBytes={totalStorageBytes}
            totalProjectsCount={projects.length}
            onRefreshData={refreshStorageData}
          />
        )}

        {activeTab === 'admin' && (userSession.role === 'admin' || userSession.role === 'superadmin') && (
          <AdminConsole
            userSession={userSession}
            onUpdateSession={handleUpdateSession}
            totalStorageBytes={totalStorageBytes}
            onReturnToDashboard={() => setActiveTab('dashboard')}
            onStartViewAsUser={(targetUser, sessionId, scopedToken) => {
              if (scopedToken) {
                omniDocClient.setToken(scopedToken);
              }
              const viewSession: UserSession = {
                isGuest: false,
                userEmail: targetUser.email,
                userName: targetUser.full_name || targetUser.email.split('@')[0],
                role: targetUser.role || 'user',
                planTier: targetUser.plan_tier || targetUser.plan || 'free',
                isAuthenticated: true,
                storageUsedBytes: targetUser.storage_used_bytes || 0,
                jwtToken: scopedToken || userSession.jwtToken,
                authSource: 'backend'
              };
              handleUpdateSession(viewSession);

              setViewAsUserSession({
                active: true,
                targetUser,
                sessionId,
                originalAdminSession: userSession
              });
              setActiveTab('dashboard');
              addToast('info', 'Viewing As User', `Workspace active context switched to ${targetUser.email} (Scoped JWT active).`);
            }}
          />
        )}
      </main>

      {/* Floating Liquid Glass Mobile Navigation Dock (iOS / Android / Mobile Gadgets) */}
      <nav className="fixed bottom-3 inset-x-3 md:hidden z-40 p-1.5 rounded-2xl bg-[#071329]/90 backdrop-blur-2xl border border-white/20 shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex items-center justify-around">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-bold shadow-md scale-105'
              : 'text-[#A7B5CC] hover:text-white'
          }`}
          title="Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('converter')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'converter'
              ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-bold shadow-md scale-105'
              : 'text-[#A7B5CC] hover:text-white'
          }`}
          title="Convert"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Convert</span>
        </button>

        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'pdf'
              ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-bold shadow-md scale-105'
              : 'text-[#A7B5CC] hover:text-white'
          }`}
          title="PDF Studio"
        >
          <FileText className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">PDF</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-bold shadow-md scale-105'
              : 'text-[#A7B5CC] hover:text-white'
          }`}
          title="Documents"
        >
          <FolderArchive className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Files</span>
        </button>

        {(userSession.role === 'admin' || userSession.role === 'superadmin') ? (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-bold shadow-md scale-105'
                : 'text-[#A7B5CC] hover:text-white'
            }`}
            title="Admin Console"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] mt-0.5">Admin</span>
          </button>
        ) : (
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#A7B5CC] hover:text-white transition-all cursor-pointer"
            title="More Studios"
          >
            <Menu className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        )}
      </nav>

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
        userRole={userSession.role || 'user'}
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

      {/* OmniDoc v2.1 Intelligent Document Engineering Modals */}
      <DocumentForensicsModal
        isOpen={isForensicsOpen}
        onClose={() => setIsForensicsOpen(false)}
      />

      <DataLineageModal
        isOpen={isLineageOpen}
        onClose={() => setIsLineageOpen(false)}
      />

      <TransformationReceiptModal
        isOpen={isReceiptsOpen}
        onClose={() => setIsReceiptsOpen(false)}
      />

      <PrivacyGuardianModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
        pdfFile={currentPdfFile}
      />

      <DocumentWhatIfModal
        isOpen={isWhatIfOpen}
        onClose={() => setIsWhatIfOpen(false)}
      />

      <TeamWorkspaceModal
        isOpen={isCollabOpen}
        onClose={() => setIsCollabOpen(false)}
      />

      <DeveloperApiModal
        isOpen={isDeveloperOpen}
        onClose={() => setIsDeveloperOpen(false)}
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
