import { TemplateItem } from '../types';

export const STARTER_TEMPLATES: TemplateItem[] = [
  {
    id: 'tpl-biz-proposal',
    title: 'Executive Business Proposal',
    category: 'Documents',
    description: 'Modern structured proposal with executive summary, deliverables, timeline, and pricing breakdown.',
    targetWorkspace: 'docx',
    badge: 'Word DOCX',
    previewGradient: 'from-blue-600 to-indigo-800',
    iconName: 'FileText',
    payload: {
      title: 'Strategic Project Proposal & Scope',
      content: `Executive Summary
This proposal outlines the deployment strategy, system architecture, and milestone delivery for the OmniDoc enterprise integration.

Objectives & Deliverables
1. Unified Document Conversion Engine: Multi-format pipeline for PDF, Word, PowerPoint, and Data sheets.
2. Privacy-First Local Processing: Edge execution for sensitive files with client-side cryptography.
3. High-Fidelity Rendering: Pixel-perfect PDF and canvas previews across desktop and tablet interfaces.

Cost & Budget Breakdown
• Core Software Engine: $12,500
• Custom Integrations & APIs: $6,800
• Performance Optimization & Testing: $4,200
Total Investment: $23,500

Next Steps & Authorization
Upon sign-off, Phase 1 deployment initiates within 3 business days.`,
    },
  },
  {
    id: 'tpl-resume',
    title: 'Senior Software Engineer CV',
    category: 'Documents',
    description: 'Clean, recruiter-approved resume format with skills matrix, project impact metrics, and education.',
    targetWorkspace: 'docx',
    badge: 'Word DOCX',
    previewGradient: 'from-slate-700 to-slate-950',
    iconName: 'UserCheck',
    payload: {
      title: 'Alex Mercer — Senior Full-Stack Engineer',
      content: `Contact: alex.mercer@devmail.io | +1 (555) 019-2834 | San Francisco, CA | github.com/alexmercer

Professional Summary
Distinguished software architect with 8+ years developing high-throughput document processing pipelines, distributed cloud applications, and responsive browser-based developer tools.

Core Competencies
• Languages: TypeScript, JavaScript, Python, Go, Rust, SQL
• Frameworks & Tools: React, Next.js, Vite, Tailwind CSS, Node.js, Docker, WebAssembly
• Document Engines: PDF.js, pdf-lib, OpenXML, SheetJS, Tesseract OCR

Work Experience
Senior Systems Engineer | CloudDoc Inc. (2023 - Present)
• Architected a high-concurrency document conversion cluster reducing latency by 42%.
• Spearheaded client-side OCR integration enabling offline recognition across 500,000 monthly active users.

Education
B.S. in Computer Science — University of California, Berkeley (Honors)`,
    },
  },
  {
    id: 'tpl-pitch-deck',
    title: 'Startup Investor Pitch Deck',
    category: 'Presentations',
    description: '16:9 modern pitch deck with Problem, Solution, Market Size, Traction, and Funding Ask slides.',
    targetWorkspace: 'slides',
    badge: 'PowerPoint PPTX',
    previewGradient: 'from-amber-600 to-orange-700',
    iconName: 'Presentation',
    payload: {
      title: 'OmniDoc Studio — Seed Round Pitch',
      slides: [
        {
          id: 'slide-1',
          title: 'Title Slide',
          bgColor: '#0f172a',
          layout: 'title',
          elements: [
            {
              id: 'el-1',
              type: 'title',
              content: 'OmniDoc Studio',
              x: 10,
              y: 20,
              width: 80,
              height: 25,
              fontSize: 48,
              fontColor: '#ffffff',
            },
            {
              id: 'el-2',
              type: 'text',
              content: 'Every file. Every format. One workspace.\nNext-generation unified document editor & conversion suite.',
              x: 10,
              y: 50,
              width: 80,
              height: 30,
              fontSize: 22,
              fontColor: '#94a3b8',
            },
          ],
        },
        {
          id: 'slide-2',
          title: 'The Problem',
          bgColor: '#1e1b4b',
          layout: 'content',
          elements: [
            {
              id: 'el-3',
              type: 'title',
              content: 'The Problem: Fragmented Document Tools',
              x: 8,
              y: 10,
              width: 84,
              height: 18,
              fontSize: 32,
              fontColor: '#f8fafc',
            },
            {
              id: 'el-4',
              type: 'text',
              content: '• Users bounce between 5 different converters, watermark tools, and editors.\n• Privacy risks: Untrusted cloud converters store proprietary documents.\n• Inconsistent formatting & loss of original structure.\n• Expensive monthly subscriptions for single-purpose utilities.',
              x: 8,
              y: 32,
              width: 84,
              height: 55,
              fontSize: 18,
              fontColor: '#c7d2fe',
            },
          ],
        },
        {
          id: 'slide-3',
          title: 'The Solution & Traction',
          bgColor: '#042f2e',
          layout: 'content',
          elements: [
            {
              id: 'el-5',
              type: 'title',
              content: 'The Solution & Rapid Adoption',
              x: 8,
              y: 10,
              width: 84,
              height: 18,
              fontSize: 32,
              fontColor: '#f0fdfa',
            },
            {
              id: 'el-6',
              type: 'text',
              content: '✓ Complete Studio: PDF + DOCX + PPTX + Sheets + Images + OCR in one canvas.\n✓ Client-Side Security: 100% private browser processing.\n✓ Fast: Zero server queue bottlenecks.\n✓ $48K MRR with 35% MoM organic growth.',
              x: 8,
              y: 32,
              width: 84,
              height: 55,
              fontSize: 18,
              fontColor: '#99f6e4',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'tpl-invoice',
    title: 'Financial Invoice & Balance Sheet',
    category: 'Spreadsheets',
    description: 'Formatted spreadsheet with itemized pricing, tax rate calculation, and automatic SUM totals.',
    targetWorkspace: 'sheets',
    badge: 'Excel XLSX',
    previewGradient: 'from-emerald-600 to-teal-800',
    iconName: 'Table',
    payload: {
      data: [
        ['INVOICE #', 'INV-2026-089', '', 'DATE', '2026-10-30', '', '', ''],
        ['CLIENT', 'Acme Enterprises Inc.', '', 'DUE DATE', '2026-11-15', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['ITEM #', 'DESCRIPTION', 'QTY', 'UNIT PRICE ($)', 'TOTAL ($)', '', '', ''],
        ['1', 'Cloud Architecture Audit', 1, 3500, '=C5*D5', '', '', ''],
        ['2', 'Security Hardening & Redaction', 3, 1200, '=C6*D6', '', '', ''],
        ['3', 'Full Stack Frontend Implementation', 80, 150, '=C7*D7', '', '', ''],
        ['4', 'Documentation & Knowledge Transfer', 1, 1500, '=C8*D8', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', 'SUBTOTAL', '=SUM(E5:E8)', '', '', ''],
        ['', '', '', 'TAX (8%)', '=E10*0.08', '', '', ''],
        ['', '', '', 'TOTAL DUE', '=E10+E11', '', '', ''],
      ],
    },
  },
  {
    id: 'tpl-social-banner',
    title: 'Product Launch Social Graphic',
    category: 'Graphics',
    description: 'Ready-to-brand image canvas with badge stickers, text layers, and vibrant backdrop.',
    targetWorkspace: 'image',
    badge: 'Image Studio',
    previewGradient: 'from-purple-600 to-pink-600',
    iconName: 'Image',
    payload: {
      width: 1200,
      height: 630,
      layers: [
        {
          id: 'lyr-1',
          type: 'text',
          text: 'OMNIDOC STUDIO 2.0',
          fontSize: 48,
          fontColor: '#ffffff',
          x: 80,
          y: 220,
        },
        {
          id: 'lyr-2',
          type: 'text',
          text: 'Convert, Edit & Create Any Document in One Place',
          fontSize: 24,
          fontColor: '#cbd5e1',
          x: 80,
          y: 280,
        },
        {
          id: 'lyr-3',
          type: 'sticker',
          text: 'PRO',
          bgColor: '#7CC4ED',
          x: 80,
          y: 130,
          width: 70,
          height: 36,
        },
      ],
    },
  },
];
