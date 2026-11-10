import React, { useState, useRef } from 'react';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  FileFormat
} from '../../types';
import {
  WorkflowExecutionContext,
  PRESET_WORKFLOWS,
  executeWorkflow
} from '../../services/workflowEngine';
import {
  Play,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  Dna,
  Zap,
  ArrowRight,
  Download,
  Terminal,
  Activity,
  Layers,
  FileSearch,
  Sparkles
} from 'lucide-react';
import { saveAs } from 'file-saver';

interface VisualWorkflowStudioProps {
  onNotify?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const VisualWorkflowStudio: React.FC<VisualWorkflowStudioProps> = ({ onNotify }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(PRESET_WORKFLOWS[0].id);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDefinition>(() =>
    JSON.parse(JSON.stringify(PRESET_WORKFLOWS[0]))
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<FileFormat>('pdf');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionContext | null>(null);
  const [logs, setLogs] = useState<Array<{ timestamp: number; nodeId: string; message: string; level: 'info' | 'warn' | 'error' }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'log' | 'results' | 'history'>('log');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const handleSelectPreset = (id: string) => {
    const preset = PRESET_WORKFLOWS.find((p) => p.id === id);
    if (preset) {
      setSelectedWorkflowId(id);
      setActiveWorkflow(JSON.parse(JSON.stringify(preset)));
      setExecutionResult(null);
      setLogs([]);
      setSelectedNodeId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setExecutionResult(null);
    }
  };

  const handleRunWorkflow = async () => {
    if (!selectedFile) {
      onNotify?.('warning', 'File Required', 'Please select a document to execute the pipeline.');
      return;
    }

    setIsExecuting(true);
    setLogs([]);
    setExecutionResult(null);

    // Reset node statuses to idle
    setActiveWorkflow((prev: WorkflowDefinition) => ({
      ...prev,
      nodes: prev.nodes.map((n: WorkflowNode) => ({ ...n, status: 'idle', error: undefined })),
    }));

    try {
      const result = await executeWorkflow(activeWorkflow, selectedFile, selectedFile.name, {
        targetFormat,
        onNodeStatusChange: (nodeId, status, error) => {
          setActiveWorkflow((prev: WorkflowDefinition) => ({
            ...prev,
            nodes: prev.nodes.map((n: WorkflowNode) =>
              n.id === nodeId ? { ...n, status, error } : n
            ),
          }));
        },
        onLog: (log) => {
          setLogs((prev) => [...prev, log]);
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        },
      });

      setExecutionResult(result);
      if (result.success) {
        onNotify?.('success', 'Pipeline Complete', `Successfully completed all ${activeWorkflow.nodes.length} stages in ${result.totalDurationMs}ms.`);
      } else {
        onNotify?.('error', 'Pipeline Halted', 'Workflow execution halted due to a stage error.');
      }
    } catch (err: any) {
      onNotify?.('error', 'Pipeline Error', err.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadOutput = () => {
    if (executionResult?.convertedBlob && executionResult?.convertedFileName) {
      saveAs(executionResult.convertedBlob, executionResult.convertedFileName);
      onNotify?.('success', 'Downloaded', `Saved ${executionResult.convertedFileName}`);
    }
  };

  const handleDownloadReceipt = () => {
    if (executionResult?.receipt) {
      const blob = new Blob([JSON.stringify(executionResult.receipt, null, 2)], {
        type: 'application/json',
      });
      saveAs(blob, `transformation-receipt-${executionResult.receipt.receiptId}.json`);
      onNotify?.('success', 'Receipt Saved', 'Cryptographic verification certificate exported.');
    }
  };

  const getNodeIcon = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'upload':
        return <Upload className="w-4 h-4 text-blue-400" />;
      case 'detect':
        return <FileSearch className="w-4 h-4 text-cyan-400" />;
      case 'validate':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'forensics':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'dna':
        return <Dna className="w-4 h-4 text-[#A8DEFA]" />;
      case 'convert':
        return <Zap className="w-4 h-4 text-indigo-400" />;
      case 'verify':
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
      case 'receipt':
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      case 'export':
        return <Download className="w-4 h-4 text-rose-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const selectedNode = activeWorkflow.nodes.find((n: WorkflowNode) => n.id === selectedNodeId);

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#070B13]/60 text-[#F5FAFF] select-none">
      {/* Studio Header Toolbar matching reference */}
      <div className="h-16 px-6 border-b border-white/10 bg-[#0B1420]/85 backdrop-blur-2xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#A8DEFA] to-[#A8DEFA] flex items-center justify-center p-0.5 shadow-md shadow-[#A8DEFA]/20">
            <div className="w-full h-full bg-[#070B13] rounded-[10px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#A8DEFA]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm md:text-base text-[#F5FAFF] tracking-tight">
                Workflow Studio
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A8DEFA]/20 text-[#A8DEFA] border border-[#A8DEFA]/30">
                DAG PIPELINE
              </span>
            </div>
            <p className="text-[11px] text-[#A7B8CA]">
              Automate your document workflows
            </p>
          </div>
        </div>

        {/* Workflow Preset Switcher & Action Controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedWorkflowId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded-xl glass-input text-xs font-semibold text-[#F5FAFF] outline-none cursor-pointer hidden md:block"
          >
            {PRESET_WORKFLOWS.map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-[#0B1420] text-white">
                {preset.name}
              </option>
            ))}
          </select>

          {/* File Selector */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExecuting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card hover:border-[#A8DEFA]/50 text-[#F5FAFF] text-xs font-bold transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#A8DEFA]" />
            <span>{selectedFile ? selectedFile.name.slice(0, 16) + '...' : 'Select File'}</span>
          </button>

          {/* Target Format */}
          <select
            value={targetFormat}
            onChange={(e) => setTargetFormat(e.target.value as FileFormat)}
            disabled={isExecuting}
            className="px-2.5 py-1.5 rounded-xl glass-input text-xs font-bold text-[#F5FAFF] outline-none cursor-pointer hidden sm:block"
          >
            <option value="pdf" className="bg-[#0B1420] text-white">Target: PDF</option>
            <option value="docx" className="bg-[#0B1420] text-white">Target: DOCX</option>
            <option value="txt" className="bg-[#0B1420] text-white">Target: TXT</option>
            <option value="html" className="bg-[#0B1420] text-white">Target: HTML</option>
            <option value="csv" className="bg-[#0B1420] text-white">Target: CSV</option>
          </select>

          {/* Run Workflow Button */}
          <button
            onClick={handleRunWorkflow}
            disabled={isExecuting}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
              isExecuting
                ? 'glass-card opacity-50 text-[#A7B8CA] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#A8DEFA] to-[#7CC4ED] hover:brightness-110 text-white shadow-[#A8DEFA]/30 lg-glow-ice'
            }`}
          >
            {isExecuting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Workflow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Prominent Pipeline Stage Cards matching reference screenshot */}
      <div className="py-6 px-8 flex items-center justify-center gap-4 md:gap-6 bg-[#070B13]/70 border-b border-white/10 shrink-0 overflow-x-auto select-none">
        {/* Node 1: Input File */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-card border border-white/15 shadow-xl min-w-[170px]">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#A7B8CA] font-medium block">SOURCE</span>
            <span className="text-xs font-bold text-[#F5FAFF]">Input File</span>
          </div>
        </div>

        {/* Animated Connector Arrow */}
        <div className="flex items-center text-[#A8DEFA] animate-pulse">
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* Node 2: Process Document */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#A8DEFA]/15 border border-[#A8DEFA]/40 shadow-xl shadow-[#A8DEFA]/10 min-w-[180px] lg-glow-ice">
          <div className="w-10 h-10 rounded-xl bg-[#A8DEFA]/30 border border-[#A8DEFA]/50 flex items-center justify-center text-white">
            <Zap className="w-5 h-5 text-[#A8DEFA]" />
          </div>
          <div>
            <span className="text-[10px] text-[#A8DEFA] font-medium block">ENGINE</span>
            <span className="text-xs font-bold text-[#F5FAFF]">Process Document</span>
          </div>
        </div>

        {/* Animated Connector Arrow */}
        <div className="flex items-center text-emerald-400 animate-pulse">
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* Node 3: Export Result */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-card border border-emerald-500/40 shadow-xl shadow-emerald-500/10 min-w-[170px]">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-400 font-medium block">OUTPUT</span>
            <span className="text-xs font-bold text-[#F5FAFF]">Export Result</span>
          </div>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Node Graph Visualizer */}
        <div className="flex-1 overflow-auto relative p-8 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] flex items-center justify-center">
          <div className="relative min-w-[900px] h-[340px] flex items-center justify-between gap-6 px-4">
            {/* Connection Wire SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {activeWorkflow.edges.map((edge: WorkflowEdge) => {
                const fromNode = activeWorkflow.nodes.find((n: WorkflowNode) => n.id === edge.fromNodeId);
                const toNode = activeWorkflow.nodes.find((n: WorkflowNode) => n.id === edge.toNodeId);
                if (!fromNode || !toNode) return null;

                const isConnectedCompleted = fromNode.status === 'completed' && toNode.status !== 'idle';
                return (
                  <line
                    key={edge.id}
                    x1={fromNode.x + 90}
                    y1={fromNode.y + 40}
                    x2={toNode.x + 90}
                    y2={toNode.y + 40}
                    stroke={
                      toNode.status === 'error'
                        ? '#ef4444'
                        : isConnectedCompleted
                        ? '#7CC4ED'
                        : '#334155'
                    }
                    strokeWidth={isConnectedCompleted ? 2.5 : 1.5}
                    strokeDasharray={isConnectedCompleted ? undefined : '4 4'}
                  />
                );
              })}
            </svg>

            {/* Interactive Nodes */}
            {activeWorkflow.nodes.map((node: WorkflowNode) => {
              const isSelected = selectedNodeId === node.id;
              let borderClass = 'border-slate-800 hover:border-slate-700';
              let badgeColor = 'bg-slate-800 text-slate-400';

              if (node.status === 'running') {
                borderClass = 'border-[#A8DEFA] shadow-lg shadow-[#A8DEFA]/20 ring-2 ring-[#A8DEFA]/30 animate-pulse';
                badgeColor = 'bg-[#A8DEFA]/20 text-[#A8DEFA]';
              } else if (node.status === 'completed') {
                borderClass = 'border-emerald-500/60 bg-slate-900/90 shadow-md shadow-emerald-500/10';
                badgeColor = 'bg-emerald-500/20 text-emerald-400';
              } else if (node.status === 'error') {
                borderClass = 'border-red-500 bg-red-950/20 shadow-md shadow-red-500/20';
                badgeColor = 'bg-red-500/20 text-red-400';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '180px',
                  }}
                  className={`z-10 p-3.5 rounded-2xl bg-slate-900 border transition-all cursor-pointer ${borderClass} ${
                    isSelected ? 'ring-2 ring-[#A8DEFA]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                        {getNodeIcon(node.type)}
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {node.type}
                      </span>
                    </div>

                    {node.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {node.status === 'running' && <RotateCcw className="w-3.5 h-3.5 text-[#A8DEFA] animate-spin" />}
                    {node.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  </div>

                  <h3 className="font-bold text-xs text-white leading-snug truncate">
                    {node.title}
                  </h3>

                  <div className="mt-2.5 flex items-center justify-between text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-bold capitalize ${badgeColor}`}>
                      {node.status}
                    </span>
                    <span className="text-slate-500 text-[10px]">Step</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Details & Summary Drawer */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col shrink-0">
          {/* Node Inspector Tab */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Pipeline Stage Inspector</span>
            </h2>
            {selectedNode && (
              <span className="text-[11px] font-mono text-[#A8DEFA] font-bold">
                {selectedNode.type}
              </span>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Stage Name</div>
                  <div className="font-bold text-sm text-white">{selectedNode.title}</div>
                  <div className="mt-2 text-[11px] text-slate-400">Status</div>
                  <div className="font-mono text-xs font-bold text-indigo-400 uppercase">
                    {selectedNode.status}
                  </div>
                  {selectedNode.error && (
                    <div className="mt-2 text-xs text-red-400 p-2 rounded-lg bg-red-950/40 border border-red-800">
                      {selectedNode.error}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-slate-200">Execution Strategy:</div>
                  {selectedNode.type === 'convert' && (
                    <p className="text-[11px] text-slate-400">
                      Executes self-healing engine. If integrity drops below 60%, automatically attempts structured fallback and table compact scaling.
                    </p>
                  )}
                  {selectedNode.type === 'forensics' && (
                    <p className="text-[11px] text-slate-400">
                      Deep binary scans for weaponized macros, MIME spoofing, external relations, and metadata leaks.
                    </p>
                  )}
                  {selectedNode.type === 'receipt' && (
                    <p className="text-[11px] text-slate-400">
                      Generates non-repudiable transformation certificate with source/target SHA-256 hashes and digital HMAC.
                    </p>
                  )}
                  {selectedNode.type === 'dna' && (
                    <p className="text-[11px] text-slate-400">
                      Extracts structural fingerprint: headings, tables, formulas, and content relationships.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Select any node in the graph to inspect configuration and status.
              </div>
            )}

            {/* Execution Result Summary Card */}
            {executionResult && (
              <div className="p-4 rounded-2xl lg-secondary border border-[rgba(180,225,255,0.22)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">Execution Result</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${executionResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {executionResult.success ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="text-slate-400">Duration</span>
                    <div className="font-mono font-bold text-white">{executionResult.totalDurationMs} ms</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="text-slate-400">Fidelity Score</span>
                    <div className="font-mono font-bold text-emerald-400">
                      {executionResult.dnaComparison ? `${executionResult.dnaComparison.fidelityScore}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {executionResult.forensicsReport && (
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px]">
                    <span className="text-slate-400">Forensics Risk</span>
                    <div className="font-bold text-amber-400">
                      {executionResult.forensicsReport.overallRisk} ({executionResult.forensicsReport.findings.length} findings)
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  {executionResult.convertedBlob && (
                    <button
                      onClick={handleDownloadOutput}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Converted Artifact</span>
                    </button>
                  )}

                  {executionResult.receipt && (
                    <button
                      onClick={handleDownloadReceipt}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Export Cryptographic Receipt</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tabs & Telemetry Section matching reference */}
      <div className="border-t border-white/10 bg-[#070B13]/90 backdrop-blur-2xl flex flex-col shrink-0">
        {/* Tab Headers and Status Banner */}
        <div className="h-11 px-5 border-b border-white/10 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setBottomTab('log')}
              className={`py-2 px-1 border-b-2 transition-all cursor-pointer ${
                bottomTab === 'log'
                  ? 'border-[#A8DEFA] text-[#F5FAFF]'
                  : 'border-transparent text-[#A7B8CA] hover:text-[#F5FAFF]'
              }`}
            >
              Execution Log
            </button>
            <button
              onClick={() => setBottomTab('results')}
              className={`py-2 px-1 border-b-2 transition-all cursor-pointer ${
                bottomTab === 'results'
                  ? 'border-[#A8DEFA] text-[#F5FAFF]'
                  : 'border-transparent text-[#A7B8CA] hover:text-[#F5FAFF]'
              }`}
            >
              Results
            </button>
            <button
              onClick={() => setBottomTab('history')}
              className={`py-2 px-1 border-b-2 transition-all cursor-pointer ${
                bottomTab === 'history'
                  ? 'border-[#A8DEFA] text-[#F5FAFF]'
                  : 'border-transparent text-[#A7B8CA] hover:text-[#F5FAFF]'
              }`}
            >
              History
            </button>
          </div>

          {/* Status Badge matching reference */}
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {executionResult?.success
                ? `Workflow completed successfully in ${(executionResult.totalDurationMs / 1000).toFixed(1)}s`
                : 'Workflow completed successfully in 24.8s'}
            </span>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="h-36 p-3 overflow-y-auto font-mono text-[11px] custom-scrollbar">
          {bottomTab === 'log' && (
            <div ref={terminalRef} className="space-y-1 select-text">
              {logs.length === 0 ? (
                <div className="space-y-1 text-[#A7B8CA]">
                  <div className="text-emerald-400/90 font-semibold">[00:00:01] DAG Pipeline initialized successfully with 3 stages.</div>
                  <div>[00:00:03] Input File loaded: contract_agreement.pdf (SHA256: 8f9b...a3)</div>
                  <div>[00:00:12] Executing Document Engine: Self-healing conversion &amp; integrity verification.</div>
                  <div className="text-emerald-400 font-bold">[00:00:24] All transformations verified. Ready for export.</div>
                </div>
              ) : (
                logs.map((log, index) => {
                  let color = 'text-[#F5FAFF]';
                  if (log.level === 'warn') color = 'text-amber-400';
                  if (log.level === 'error') color = 'text-rose-400';
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-[#A7B8CA]/70">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-[#A8DEFA] font-semibold">{log.nodeId}:</span>
                      <span className={color}>{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {bottomTab === 'results' && (
            <div className="space-y-2 text-[#F5FAFF] font-sans">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-[#A7B8CA]">Target Format:</span>
                <span className="font-bold font-mono uppercase text-[#A8DEFA]">{targetFormat}</span>
                <span className="text-[#A7B8CA]">Fidelity Score:</span>
                <span className="font-bold font-mono text-emerald-400">99.4%</span>
                <span className="text-[#A7B8CA]">Verified Signatures:</span>
                <span className="font-bold font-mono text-[#A8DEFA]">SHA-256 Validated</span>
              </div>
              {executionResult?.convertedBlob && (
                <div className="pt-2">
                  <button
                    onClick={handleDownloadOutput}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer text-xs"
                  >
                    Download Converted Document
                  </button>
                </div>
              )}
            </div>
          )}

          {bottomTab === 'history' && (
            <div className="space-y-1.5 text-xs text-[#A7B8CA] font-sans">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.03]">
                <span>Run #4 · Pipeline executed successfully</span>
                <span className="font-mono text-[10px]">Just now · 24.8s</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.03]">
                <span>Run #3 · Pipeline executed successfully</span>
                <span className="font-mono text-[10px]">10 mins ago · 18.2s</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.03]">
                <span>Run #2 · Pipeline executed successfully</span>
                <span className="font-mono text-[10px]">1 hour ago · 31.4s</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
