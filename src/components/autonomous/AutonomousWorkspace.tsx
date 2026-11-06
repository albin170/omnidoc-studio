import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  XCircle,
  HelpCircle,
  RefreshCw,
  Cpu,
  Lock,
  ChevronRight,
  Database,
  Building2,
  Search,
  Share2,
  FileDiff,
  GitMerge,
  Scale
} from 'lucide-react';
import {
  AutonomousJob,
  ProcessingMode,
  ExtractedEvidenceField
} from '../../types';
import { autonomousService } from '../../services/autonomousService';
import saveAs from 'file-saver';

export const AutonomousWorkspace: React.FC = () => {
  const [subTab, setSubTab] = useState<'agent' | 'radar' | 'graph' | 'search'>('agent');
  const [mode, setMode] = useState<ProcessingMode>('hybrid');
  const [objective, setObjective] = useState(
    'Reconcile incoming vendor invoices, detect cross-document collisions or duplicate numbers, extract VAT and grand totals with bounding evidence, and synthesize an audit-ready Excel workbook.'
  );
  const [selectedPreset, setSelectedPreset] = useState('invoice');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeJob, setActiveJob] = useState<AutonomousJob | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>('total');
  const [rejectionReason, setRejectionReason] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(() => autonomousService.searchDocuments(''));

  // Intelligence data
  const crossDocData = autonomousService.analyzeCrossDocuments();
  const graphData = autonomousService.getEvidenceGraph();

  const presets = [
    {
      id: 'invoice',
      name: 'Invoice Intelligence & Reconciliation',
      desc: 'Multi-invoice validation, tax variance checks, duplicate detection & Excel synthesis',
      prompt:
        'Reconcile incoming vendor invoices, detect cross-document collisions or duplicate numbers, extract VAT and grand totals with bounding evidence, and synthesize an audit-ready Excel workbook.',
    },
    {
      id: 'contract',
      name: 'Contract Compliance & Obligation Audit',
      desc: 'Extract key clauses, governing laws, termination dates, and liability caps',
      prompt:
        'Audit master services agreements, extract effective dates, liability limits, and dispute resolution venues with exact paragraph citations.',
    },
    {
      id: 'duplicate',
      name: 'Cross-Document Anomaly & Collision Hunter',
      desc: 'Detect duplicate documents, altered figures, and suspicious revisions',
      prompt:
        'Compare 10+ procurement records, compute document DNA, and highlight inconsistent monetary totals or conflicting signatures.',
    },
  ];

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) setObjective(found.prompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchResults(autonomousService.searchDocuments(searchQuery));
  };

  const handleStartPlan = async () => {
    setIsRunning(true);
    const fileNames =
      uploadedFiles.length > 0
        ? uploadedFiles.map((f) => f.name)
        : ['Acme_Vendor_Invoice_9042.pdf', 'NextGen_Security_Invoice_9043.pdf'];

    const plan = autonomousService.generatePlan(objective, fileNames, mode);
    let job: AutonomousJob = {
      id: `job_${Date.now()}`,
      title: presets.find((p) => p.id === selectedPreset)?.name || 'Custom Autonomous Operation',
      objective,
      status: 'running',
      mode,
      plan,
      currentStepIndex: 0,
      totalSteps: plan.nodes.length,
      uploadedFiles,
      createdAt: new Date().toISOString(),
    };

    setActiveJob(job);

    while (job.status === 'running') {
      job = await autonomousService.executeJobStep(job);
      setActiveJob({ ...job });
      if (job.status === 'awaiting_approval' || job.status === 'completed' || job.status === 'failed') {
        break;
      }
    }
    setIsRunning(false);
  };

  const handleApproveStep = async (approved: boolean) => {
    if (!activeJob) return;
    setIsRunning(true);
    let job = await autonomousService.approveStep(activeJob, approved, rejectionReason);
    setActiveJob({ ...job });

    while (job.status === 'running') {
      job = await autonomousService.executeJobStep(job);
      setActiveJob({ ...job });
      if (job.status === 'awaiting_approval' || job.status === 'completed' || job.status === 'failed') {
        break;
      }
    }
    setIsRunning(false);
  };

  const handleCancelJob = () => {
    if (!activeJob) return;
    const cancelled = autonomousService.cancelJob(activeJob);
    setActiveJob(cancelled);
    setIsRunning(false);
  };

  const handleDownloadArtifact = (artifact: any) => {
    if (artifact.blob) {
      saveAs(artifact.blob, artifact.name);
    }
  };

  return (
    <div className="flex-1 bg-[#080B18]/60 text-[#F4F5FF] flex flex-col overflow-y-auto custom-scrollbar">
      {/* Top Banner & Mode Selector */}
      <div className="border-b border-white/10 bg-[#11152A]/85 p-6 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                OmniDoc 2.0 Autonomous Engine
              </span>
              <span className="text-xs text-[#9BA3BD]">Strict Tool Constraints &amp; Verifiable Provenance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F4F5FF] mt-1">
              Autonomous Document Engineering Workspace
            </h1>
            <p className="text-sm text-[#9BA3BD]">
              Natural-language intent decomposition, DAG execution graphs, typed tool execution, and source evidence traceability.
            </p>
          </div>

          {/* Processing Mode Toggles */}
          <div className="glass-card p-1.5 rounded-2xl border-white/10 flex items-center gap-1">
            <button
              onClick={() => setMode('local')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${mode === 'local'
                  ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/20'
                  : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Private Local</span>
            </button>
            <button
              onClick={() => setMode('hybrid')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${mode === 'hybrid'
                  ? 'bg-[#8B7CFF]/25 border border-[#8B7CFF]/40 text-[#F4F5FF] shadow-lg shadow-[#8B7CFF]/20 glow-purple'
                  : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hybrid Mode</span>
            </button>
            <button
              onClick={() => setMode('cloud')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${mode === 'cloud'
                  ? 'bg-[#42D6E8]/25 border border-[#42D6E8]/40 text-[#42D6E8] shadow-lg shadow-[#42D6E8]/20'
                  : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Org Cloud</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto">
          <button
            onClick={() => setSubTab('agent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subTab === 'agent'
                ? 'glass-btn-primary shadow-lg shadow-[#8B7CFF]/25 glow-purple'
                : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05]'
              }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Autonomous Execution &amp; Plan DAG</span>
          </button>

          <button
            onClick={() => setSubTab('radar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subTab === 'radar'
                ? 'glass-btn-primary shadow-lg shadow-[#8B7CFF]/25 glow-purple'
                : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05]'
              }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Cross-Document &amp; Contradiction Radar</span>
          </button>

          <button
            onClick={() => setSubTab('graph')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subTab === 'graph'
                ? 'glass-btn-primary shadow-lg shadow-[#8B7CFF]/25 glow-purple'
                : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05]'
              }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Evidence Graph &amp; Provenance</span>
          </button>

          <button
            onClick={() => setSubTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subTab === 'search'
                ? 'glass-btn-primary shadow-lg shadow-[#8B7CFF]/25 glow-purple'
                : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05]'
              }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Semantic Document Search</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* TAB 1: Autonomous Agent Execution */}
        {subTab === 'agent' && (
          <>
            {/* Objective & File Input Card */}
            <div className="glass-panel border-white/12 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#F4F5FF] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#8B7CFF]" />
                    Define Autonomous Document Objective
                  </h2>
                  <p className="text-xs text-[#9BA3BD] mt-0.5">
                    Select an engineering workflow preset or enter custom requirements.
                  </p>
                </div>
                {/* Presets buttons */}
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPreset(p.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all ${selectedPreset === p.id
                          ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/40 shadow-sm'
                          : 'glass-card text-[#9BA3BD] border-white/10 hover:text-[#F4F5FF]'
                        }`}
                    >
                      {p.name.split(' ')[0]} Intelligence
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  placeholder="State your goal (e.g., extract invoice line items, detect tax discrepancies, synthesize reconciliation Excel workbook)..."
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 cursor-pointer transition-all">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>
                        {uploadedFiles.length > 0
                          ? `${uploadedFiles.length} file(s) attached`
                          : 'Attach Target Files (PDF / XLSX / Images)'}
                      </span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                      />
                    </label>
                    {uploadedFiles.length > 0 && (
                      <button
                        onClick={() => setUploadedFiles([])}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleStartPlan}
                    disabled={isRunning}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all ${isRunning
                        ? 'bg-slate-800 cursor-not-allowed text-slate-500'
                        : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 shadow-indigo-900/30'
                      }`}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Executing Plan...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Generate Plan &amp; Execute</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Active Execution Plan Card */}
            {activeJob && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${activeJob.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : activeJob.status === 'awaiting_approval'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : activeJob.status === 'running'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                      >
                        {activeJob.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        Step {activeJob.currentStepIndex} of {activeJob.totalSteps}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{activeJob.title}</h3>
                  </div>

                  {activeJob.status !== 'completed' && activeJob.status !== 'cancelled' && (
                    <button
                      onClick={handleCancelJob}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer"
                    >
                      Cancel Execution
                    </button>
                  )}
                </div>

                {/* Visual DAG Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {activeJob.plan.nodes.map((node, idx) => (
                    <div
                      key={node.id}
                      className={`p-4 rounded-2xl border transition-all ${node.status === 'completed'
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : node.status === 'waiting_approval'
                            ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/20'
                            : node.status === 'running'
                              ? 'bg-indigo-950/30 border-indigo-500/50'
                              : node.status === 'failed'
                                ? 'bg-rose-950/20 border-rose-500/40'
                                : 'bg-slate-950/50 border-slate-800'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-200">
                            {idx + 1}
                          </span>
                          {node.toolName}
                        </span>

                        {node.status === 'completed' && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done
                          </span>
                        )}
                        {node.status === 'waiting_approval' && (
                          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Requires Review
                          </span>
                        )}
                        {node.status === 'running' && (
                          <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Running
                          </span>
                        )}
                        {node.status === 'pending' && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Queued
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-slate-200 line-clamp-2">{node.description}</p>
                    </div>
                  ))}
                </div>

                {/* Human in the loop review gate */}
                {activeJob.status === 'awaiting_approval' && (
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-amber-300">
                          Human Review Gate: Action Approval Required
                        </h4>
                        <p className="text-xs text-slate-300">
                          The autonomous agent detected a mathematical variance between the computed tax rate
                          (9% VAT = $1,350) and reported supplier tax total ($1,500). Please approve or override
                          before Excel ledger synthesis.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleApproveStep(true)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                      >
                        Approve &amp; Continue Synthesis
                      </button>
                      <button
                        onClick={() => handleApproveStep(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        Reject Step
                      </button>
                    </div>
                  </div>
                )}

                {/* Extracted Fields & Digital Twin Evidence */}
                {activeJob.extractedFields && (
                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Document Digital Twin Evidence &amp; Coordinate Traceability
                      </h4>
                      <span className="text-xs text-slate-400">Zero Guessing Policy Enforced</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Extracted Fields Table */}
                      <div className="bg-slate-950/60 rounded-2xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-3">Field Name</th>
                              <th className="p-3">Extracted Value</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Confidence</th>
                              <th className="p-3">Evidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {Object.entries(activeJob.extractedFields).map(([key, field]) => (
                              <tr
                                key={key}
                                onClick={() => setSelectedFieldKey(key)}
                                className={`cursor-pointer transition-colors ${selectedFieldKey === key ? 'bg-indigo-950/40' : 'hover:bg-slate-900/40'
                                  }`}
                              >
                                <td className="p-3 font-semibold text-slate-300">{field.fieldName}</td>
                                <td className="p-3 font-mono text-emerald-300">{String(field.value)}</td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${field.status === 'confirmed'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-amber-500/20 text-amber-400'
                                      }`}
                                  >
                                    {field.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-slate-300">
                                  {Math.round(field.confidence * 100)}%
                                </td>
                                <td className="p-3 text-slate-400 font-mono text-[11px]">
                                  P.{field.pageNumber} [{field.bbox?.x}, {field.bbox?.y}]
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Interactive Document Coordinate Canvas Visualizer */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            Source Document Evidence Canvas (Page 1)
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Target: Acme_Vendor_Invoice_9042.pdf
                          </span>
                        </div>

                        {/* Canvas Representation of Invoice with highlighted Bounding Box */}
                        <div className="my-4 h-64 bg-slate-900 rounded-xl border border-slate-800 relative p-4 font-mono text-[10px] text-slate-500 select-none overflow-hidden">
                          <div className="border-b border-slate-800 pb-2 mb-2 flex justify-between">
                            <span className="text-slate-300 font-bold">OmniGlobal Cloud Systems Inc.</span>
                            <span>INVOICE #9042</span>
                          </div>
                          <div className="space-y-1 text-slate-400">
                            <div>Billed To: Alpha Procurement Enterprise</div>
                            <div>Date: March 24, 2026</div>
                            <div>Payment Terms: Net 30</div>
                          </div>

                          <div className="mt-4 border-t border-slate-800 pt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Cloud Cluster DCU Compute (1,200 hrs)</span>
                              <span>$15,000.00</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Standard 9% VAT Tax</span>
                              <span>$1,350.00</span>
                            </div>
                            <div className="flex justify-between font-bold text-slate-200 pt-1 border-t border-slate-800">
                              <span>Grand Total Due</span>
                              <span>$16,350.00</span>
                            </div>
                          </div>

                          {/* Highlighted Bounding Box Overlay */}
                          {selectedFieldKey && activeJob.extractedFields[selectedFieldKey]?.bbox && (
                            <div
                              className="absolute border-2 border-emerald-400 bg-emerald-500/20 rounded shadow-sm transition-all flex items-center justify-end px-1"
                              style={{
                                left: `${(activeJob.extractedFields[selectedFieldKey].bbox!.x / 600) * 100}%`,
                                top: `${(activeJob.extractedFields[selectedFieldKey].bbox!.y / 400) * 100}%`,
                                width: `${(activeJob.extractedFields[selectedFieldKey].bbox!.width / 600) * 100}%`,
                                height: '24px',
                              }}
                            >
                              <span className="text-[9px] font-bold bg-emerald-500 text-slate-950 px-1 rounded -top-3 absolute">
                                CONFIRMED EVIDENCE
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>Clicking any field above locks the verified bounding box.</span>
                          <span className="text-emerald-400 font-semibold">100% Cryptographic Match</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generated Artifacts & Verification Report */}
                {activeJob.verificationReport && (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-sm font-bold text-emerald-300">
                          Output Verification &amp; Reconciliation Receipt
                        </h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
                        VERIFIED MATRICES
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{activeJob.verificationReport.notes}</p>

                    {activeJob.generatedArtifacts && activeJob.generatedArtifacts.length > 0 && (
                      <div className="pt-2 flex items-center gap-3">
                        {activeJob.generatedArtifacts.map((art, i) => (
                          <button
                            key={i}
                            onClick={() => handleDownloadArtifact(art)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Download {art.name}</span>
                            <Download className="w-3.5 h-3.5 ml-1" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 2: Cross-Document & Contradiction Radar */}
        {subTab === 'radar' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-400" />
                    Cross-Document Collision &amp; Contradiction Radar
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scans document corpora to discover duplicate submissions, modified numbers, and conflicting contract terms.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {crossDocData.contradictions.length} Contradictions Detected
                </span>
              </div>

              {/* Contradiction Cards */}
              <div className="space-y-3 pt-2">
                {crossDocData.contradictions.map((contra, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300">
                          {contra.severity} CONTRADICTION
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          Field: {contra.field}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">Cross-Vendor Collision</span>
                    </div>

                    <p className="text-xs text-slate-200">{contra.explanation}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">{contra.docA}</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">{contra.valA}</span>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">{contra.docB}</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">{contra.valB}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Duplicates Section */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Duplicate Document Submissions Detected ({crossDocData.duplicates.length})
                </h4>
                {crossDocData.duplicates.map((dup, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <FileDiff className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-semibold text-slate-200">
                          {dup.docA} &harr; {dup.docB}
                        </div>
                        <span className="text-[11px] text-slate-400">Similarity Metric: {dup.type}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                      {Math.round(dup.similarity * 100)}% Match
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Evidence Graph & Provenance */}
        {subTab === 'graph' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-400" />
                Evidence Graph &amp; Provenance Topology
              </h3>
              <p className="text-xs text-slate-400">
                Visualizing relationships between raw document bytes, extracted claims, and verified ledger facts.
              </p>
            </div>

            {/* Visual Node-Edge Canvas */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 min-h-[380px] flex flex-col justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {graphData.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`p-3.5 rounded-2xl border transition-all ${node.type === 'document'
                        ? 'bg-blue-950/20 border-blue-500/40 text-blue-300'
                        : node.type === 'entity'
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                          : node.type === 'contradiction'
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                            : 'bg-purple-950/20 border-purple-500/40 text-purple-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        {node.type}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-current" />
                    </div>
                    <span className="text-xs font-bold font-mono block">{node.label}</span>
                  </div>
                ))}
              </div>

              {/* Edge relationships ledger */}
              <div className="mt-6 pt-4 border-t border-slate-850">
                <h4 className="text-xs font-bold text-slate-400 mb-2.5">Active Verification Edges</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {graphData.edges.map((edge, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between"
                    >
                      <span>{edge.source}</span>
                      <span className="text-indigo-400 font-bold">&rarr; {edge.label} &rarr;</span>
                      <span>{edge.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Semantic Document Search */}
        {subTab === 'search' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                Semantic Document Search &amp; Neural Query
              </h3>
              <p className="text-xs text-slate-400">
                BM25-scored term matching across Digital Twin paragraphs, tables, and confirmed entity coordinates.
              </p>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query document vault (e.g., 'liability limitation', '16350', 'tax variance')..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Search Vault
              </button>
            </form>

            {/* Results List */}
            <div className="space-y-3 pt-2">
              <span className="text-xs text-slate-400">
                Found {searchResults.length} verified coordinate matches
              </span>
              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 font-mono">
                      {res.filename} (Page {res.page})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 font-mono">
                      Score: {Math.round(res.score * 100)}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white">{res.matchText}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{res.context}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
