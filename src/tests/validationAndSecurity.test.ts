import { describe, it, expect, beforeEach } from 'vitest';
import { validateFileFormat, detectFileFormat } from '../services/formatDetector';
import { escapeHtml } from '../services/converter';
import { 
  saveProject, 
  deleteProject, 
  getStoredProjects, 
  getUserSession, 
  setUserSession 
} from '../services/storageService';
import { StoredProject } from '../types';

// In Node.js environment, mock localStorage
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => {
    if (value.includes('FORCE_QUOTA_ERROR')) {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    }
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

describe('File Format Validation & Legacy Protection', () => {
  it('validates genuine PDF files with %PDF- signature', async () => {
    const validPdf = new File(['%PDF-1.7 standard header content'], 'contract.pdf', { type: 'application/pdf' });
    const result = await validateFileFormat(validPdf);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('pdf');
  });

  it('rejects files with .pdf extension that lack %PDF- magic signature', async () => {
    const spoofedPdf = new File(['Not a PDF file at all'], 'spoofed.pdf', { type: 'application/pdf' });
    const result = await validateFileFormat(spoofedPdf);
    expect(result.valid).toBe(false);
    expect(result.format).toBeNull();
    expect(result.error).toContain('lacks the required %PDF- header signature');
  });

  it('validates PNG image with valid 8-byte PNG signature', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPng = new File([pngHeader], 'diagram.png', { type: 'image/png' });
    const result = await validateFileFormat(validPng);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('png');
  });

  it('rejects spoofed PNG missing PNG magic header', async () => {
    const spoofedPng = new File(['plain text pretending to be png'], 'fake.png', { type: 'image/png' });
    const result = await validateFileFormat(spoofedPng);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('PNG magic signature');
  });

  it('validates JPEG with SOI marker 0xFF 0xD8 0xFF', async () => {
    const jpgHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const validJpg = new File([jpgHeader], 'photo.jpg', { type: 'image/jpeg' });
    const result = await validateFileFormat(validJpg);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('jpg');
  });

  it('strictly validates WebP requiring both RIFF at byte 0 and WEBP at byte 8', async () => {
    // 12-byte valid WebP: 'RIFF' (0..3) + 4 bytes length + 'WEBP' (8..11)
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // R I F F
      0x00, 0x00, 0x00, 0x00, // file length placeholder
      0x57, 0x45, 0x42, 0x50, // W E B P
    ]);
    const validWebp = new File([webpBytes], 'image.webp', { type: 'image/webp' });
    const result = await validateFileFormat(validWebp);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('webp');
  });

  it('rejects RIFF files that are not WebP (e.g. WAV or AVI audio/video)', async () => {
    // RIFF header with 'WAVE' at byte 8 instead of 'WEBP'
    const riffWavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // R I F F
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // W A V E
    ]);
    const invalidWebp = new File([riffWavBytes], 'audio.webp', { type: 'image/webp' });
    const result = await validateFileFormat(invalidWebp);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing RIFF/WEBP container signature');
  });

  it('validates modern OpenXML documents (DOCX, PPTX, XLSX) with PK\\x03\\x04 header', async () => {
    const pkZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const docxFile = new File([pkZipHeader], 'document.docx');
    const pptxFile = new File([pkZipHeader], 'slides.pptx');
    const xlsxFile = new File([pkZipHeader], 'sheet.xlsx');

    expect((await validateFileFormat(docxFile)).valid).toBe(true);
    expect((await validateFileFormat(pptxFile)).valid).toBe(true);
    expect((await validateFileFormat(xlsxFile)).valid).toBe(true);
  });

  it('rejects legacy binary Office extensions (.doc, .ppt, .xls) with actionable message', async () => {
    const legacyDoc = new File(['dummy binary'], 'legacy.doc');
    const legacyPpt = new File(['dummy binary'], 'legacy.ppt');
    const legacyXls = new File(['dummy binary'], 'legacy.xls');

    const resDoc = await validateFileFormat(legacyDoc);
    expect(resDoc.valid).toBe(false);
    expect(resDoc.isLegacyOffice).toBe(true);
    expect(resDoc.error).toContain('Legacy binary Office format (.doc) is not supported');

    const resPpt = await validateFileFormat(legacyPpt);
    expect(resPpt.valid).toBe(false);
    expect(resPpt.isLegacyOffice).toBe(true);

    const resXls = await validateFileFormat(legacyXls);
    expect(resXls.valid).toBe(false);
    expect(resXls.isLegacyOffice).toBe(true);
  });

  it('rejects binary files containing OLE2 compound document signature', async () => {
    // 0xD0 0xCF 0x11 0xE0
    const ole2Header = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const disguisedFile = new File([ole2Header], 'disguised.docx');
    const result = await validateFileFormat(disguisedFile);
    expect(result.valid).toBe(false);
    expect(result.isLegacyOffice).toBe(true);
    expect(result.error).toContain('legacy binary compound document (OLE2)');
  });

  it('rejects zero-byte files cleanly', async () => {
    const emptyFile = new File([], 'empty.pdf');
    const result = await validateFileFormat(emptyFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('is empty (0 bytes)');
  });

  it('does not silently fall back to PDF for unknown file formats', async () => {
    const unknownFile = new File(['some random bytes'], 'archive.bin');
    const detected = await detectFileFormat(unknownFile);
    expect(detected).toBeNull();
  });
});

describe('Conversion Safety & XSS Sanitization', () => {
  it('escapes standard HTML special characters', () => {
    const raw = '<script>alert("XSS")</script>&"\'';
    const escaped = escapeHtml(raw);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&quot;&#39;');
    expect(escaped).not.toContain('<script>');
  });

  it('neutralizes hostile attribute injection and event handlers', () => {
    const payload = '"><img src=x onerror="alert(1)">';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&quot;&gt;&lt;img');
  });

  it('handles null, undefined, and non-string values safely', () => {
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
    expect(escapeHtml(12345 as any)).toBe('12345');
  });
});

describe('Project Persistence & Storage Error Resilience', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('validates project structure and throws when invalid', () => {
    expect(() => {
      saveProject({} as any);
    }).toThrow(/Invalid project structure/);

    expect(() => {
      saveProject({ id: 'p1', title: 'test', type: 'invalid_type' as any, updatedAt: 1, createdAt: 1, sizeBytes: 10, data: {} });
    }).toThrow(/Invalid project structure/);

    expect(() => {
      saveProject({ id: '', title: 'test', type: 'docx', updatedAt: 1, createdAt: 1, sizeBytes: 10, data: {} });
    }).toThrow(/Invalid project structure/);
  });

  it('saves and retrieves valid project successfully', () => {
    const validProject: StoredProject = {
      id: 'proj-101',
      title: 'Annual Report',
      type: 'docx',
      updatedAt: Date.now(),
      createdAt: Date.now(),
      sizeBytes: 256,
      data: { content: 'Strategic highlights' },
    };

    const saved = saveProject(validProject);
    expect(saved.id).toBe('proj-101');

    const list = getStoredProjects();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Annual Report');
  });

  it('surfaces storage quota exhaustion to caller without silent swallowing', () => {
    const heavyProject: StoredProject = {
      id: 'proj-heavy',
      title: 'Heavy Project',
      type: 'sheets',
      updatedAt: Date.now(),
      createdAt: Date.now(),
      sizeBytes: 1024,
      data: { gridData: 'FORCE_QUOTA_ERROR' },
    };

    expect(() => {
      saveProject(heavyProject);
    }).toThrow(/quota exceeded/i);
  });

  it('throws descriptive error when deleteProject receives invalid ID', () => {
    expect(() => {
      deleteProject('');
    }).toThrow(/Project ID is required for deletion/);
  });

  it('deletes existing project accurately', () => {
    const p1: StoredProject = { id: 'p1', title: 'P1', type: 'pdf', updatedAt: 1, createdAt: 1, sizeBytes: 1, data: {} };
    const p2: StoredProject = { id: 'p2', title: 'P2', type: 'docx', updatedAt: 1, createdAt: 1, sizeBytes: 1, data: {} };
    saveProject(p1);
    saveProject(p2);
    expect(getStoredProjects().length).toBe(2);

    deleteProject('p1');
    const remaining = getStoredProjects();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('p2');
  });

  it('gracefully handles malformed JSON in localStorage without throwing', () => {
    globalThis.localStorage.setItem('omnidoc_projects_v1', '{ corrupt json string !!!');
    const projects = getStoredProjects();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBe(0);
  });

  it('filters out corrupt project objects from storage list', () => {
    const mixed = [
      { id: 'valid-1', title: 'Valid', type: 'docx', updatedAt: 1, createdAt: 1, sizeBytes: 1, data: {} },
      { id: 'invalid-corrupt', title: 123 }, // missing required fields
    ];
    globalThis.localStorage.setItem('omnidoc_projects_v1', JSON.stringify(mixed));
    const projects = getStoredProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe('valid-1');
  });
});

describe('Authentication & Authorization Prototype Boundaries', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('defaults first-time visitor session to unverified user role on free tier', () => {
    const session = getUserSession();
    expect(session.isAuthenticated).toBe(false);
    expect(session.role).toBe('user');
    expect(session.planTier).toBe('free');
    expect(session.isLocalPrototype).toBe(true);
  });

  it('flags local session as prototype without claiming production auth', () => {
    setUserSession({
      isGuest: false,
      isAuthenticated: true,
      userEmail: 'test@omnidoc.io',
      userName: 'Test User',
      storageUsedBytes: 0,
      role: 'user',
      planTier: 'free',
      isLocalPrototype: true,
    });

    const active = getUserSession();
    expect(active.isAuthenticated).toBe(true);
    expect(active.isLocalPrototype).toBe(true);
    expect(active.role).toBe('user');
  });
});
