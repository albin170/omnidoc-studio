import React, { useState } from 'react';
import {
  X,
  Code2,
  Key,
  Copy,
  Check,
  Trash2,
  Plus,
  ShieldAlert,
  ExternalLink,
  Terminal,
  Cpu
} from 'lucide-react';
import { developerService, DeveloperApiKey } from '../../services/developerService';

interface DeveloperApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperApiModal: React.FC<DeveloperApiModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<DeveloperApiKey[]>(() => developerService.getApiKeys());
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'python' | 'ts'>('curl');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const { key, rawSecret } = developerService.createApiKey(newKeyName);
    setKeys([key, ...keys]);
    setNewlyCreatedSecret(rawSecret);
    setNewKeyName('');
    setShowCreateForm(false);
  };

  const handleDelete = (id: string) => {
    developerService.deleteApiKey(id);
    setKeys(keys.filter((k) => k.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080B18]/80 backdrop-blur-xl animate-fade-in">
      <div className="glass-panel border-white/15 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] text-[#F4F5FF]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F4F5FF]">Developer API &amp; Microservices Platform</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  OPENAPI V3 COMPLIANT
                </span>
              </div>
              <p className="text-xs text-[#9BA3BD] truncate max-w-md">
                Direct programmatic access to document parsing, verification, and autonomous agent workflows.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9BA3BD] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Secret Modal Alert when new key generated */}
          {newlyCreatedSecret && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Save Your API Key Secret Now</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                This token will never be displayed again. For security, only the key hash is stored on the server.
              </p>
              <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-amber-500/40">
                <code className="text-xs font-mono text-amber-300 select-all">{newlyCreatedSecret}</code>
                <button
                  onClick={() => copyToClipboard(newlyCreatedSecret)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Active API Keys List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider">Active API Keys</span>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg glass-btn-primary text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate New Key</span>
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form onSubmit={handleCreate} className="p-4 rounded-xl bg-white/[0.03] border border-emerald-500/30 space-y-3">
                <div className="text-xs font-bold text-[#F4F5FF]">New Scoped API Key</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Key Label (e.g. Automated Invoice Ingestion)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white/[0.04] border border-white/15 rounded-lg text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                  >
                    Generate
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#F4F5FF]">{k.name}</span>
                      <code className="text-[11px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {k.prefix}
                      </code>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#9BA3BD]">
                      <span>Rate Limit: {k.rateLimitRpm} req/min</span>
                      <span>• Created: {k.createdAt}</span>
                      {k.lastUsedAt && <span>• Last Active: {k.lastUsedAt}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="p-1.5 text-[#9BA3BD] hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quickstart SDK Code Snippets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider">Quickstart Integration</span>
              <div className="flex gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/10 text-[11px]">
                {(['curl', 'python', 'ts'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCodeTab(tab)}
                    className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all cursor-pointer ${activeCodeTab === tab
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-[#9BA3BD] hover:text-white'
                      }`}
                  >
                    {tab === 'ts' ? 'TypeScript' : tab === 'curl' ? 'cURL' : 'Python SDK'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs overflow-x-auto text-[#F4F5FF]">
              {activeCodeTab === 'curl' && (
                <pre>{`curl -X POST "http://localhost:8000/api/v1/documents/upload" \\
  -H "Authorization: Bearer $OMNIDOC_API_KEY" \\
  -F "file=@invoice_9042.pdf"`}</pre>
              )}
              {activeCodeTab === 'python' && (
                <pre>{`from omnidoc_sdk import OmniDocClient

client = OmniDocClient(base_url="http://localhost:8000/api/v1", token=OMNIDOC_API_KEY)
doc = client.upload_document("invoice_9042.pdf")
job = client.submit_job(
    title="Invoice Reconciliation",
    objective="Extract totals, check duplicates, build Excel",
    document_ids=[doc["id"]]
)
print("Job submitted:", job["id"])`}</pre>
              )}
              {activeCodeTab === 'ts' && (
                <pre>{`import { omniDocClient } from './sdk/omnidocClient';

omniDocClient.setToken(OMNIDOC_API_KEY);
const doc = await omniDocClient.uploadDocument(fileObject);
const job = await omniDocClient.submitJob(
  'Invoice Intelligence',
  'Reconcile invoices and compute VAT variance',
  [doc.id]
);`}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs">
          <a
            href="http://localhost:8000/api/v1/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <span>Open Interactive Swagger Docs (/docs)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#F4F5FF] font-semibold border border-white/10 cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
