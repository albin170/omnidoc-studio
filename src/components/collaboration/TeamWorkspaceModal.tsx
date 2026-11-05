import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  MessageSquare,
  Shield,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  Lock,
  ChevronRight
} from 'lucide-react';
import {
  collaborationService,
  TeamMember,
  DocumentCommentItem
} from '../../services/collaborationService';

interface TeamWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
}

export const TeamWorkspaceModal: React.FC<TeamWorkspaceModalProps> = ({
  isOpen,
  onClose,
  documentTitle = 'Active Project Workspace',
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'comments'>('members');
  const [members, setMembers] = useState<TeamMember[]>(() => collaborationService.getTeamMembers());
  const [comments, setComments] = useState<DocumentCommentItem[]>(() => collaborationService.getDocumentComments());

  // Invite Form State
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [showInviteForm, setShowInviteForm] = useState(false);

  // New Comment State
  const [newCommentText, setNewCommentText] = useState('');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const added = collaborationService.addTeamMember(inviteName, inviteEmail, inviteRole);
    setMembers([...members, added]);
    setInviteName('');
    setInviteEmail('');
    setShowInviteForm(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const added = collaborationService.addComment('active', newCommentText);
    setComments([added, ...comments]);
    setNewCommentText('');
  };

  const handleToggleResolve = (commentId: string) => {
    collaborationService.toggleCommentResolved('active', commentId);
    setComments(
      comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080B18]/80 backdrop-blur-xl animate-fade-in">
      <div className="glass-panel border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-[#F4F5FF]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F4F5FF]">Team Workspace &amp; Collaboration</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30">
                  TENANT ISOLATED
                </span>
              </div>
              <p className="text-xs text-[#9BA3BD] truncate max-w-md">{documentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9BA3BD] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 border-b border-white/10 flex gap-4 bg-white/[0.02] text-xs">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'members'
                ? 'border-[#8B7CFF] text-[#8B7CFF]'
                : 'border-transparent text-[#9BA3BD] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Workspace Members ({members.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-3 font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'comments'
                ? 'border-[#8B7CFF] text-[#8B7CFF]'
                : 'border-transparent text-[#9BA3BD] hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Review Comments ({comments.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'members' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#9BA3BD]">
                  Members with access to this tenant workspace
                </span>
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg glass-btn-primary text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Member</span>
                </button>
              </div>

              {/* Invite Form */}
              {showInviteForm && (
                <form onSubmit={handleInvite} className="p-4 rounded-xl bg-white/[0.03] border border-[#8B7CFF]/30 space-y-3">
                  <div className="text-xs font-bold text-[#F4F5FF]">Invite Team Collaborator</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/15 rounded-lg text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                    />
                    <input
                      type="email"
                      placeholder="Corporate Email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/15 rounded-lg text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="px-3 py-1 text-xs bg-[#11152A] border border-white/15 rounded-lg text-[#F4F5FF]"
                    >
                      <option value="editor">Role: Editor</option>
                      <option value="viewer">Role: Viewer</option>
                      <option value="admin">Role: Admin</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-3 py-1 text-xs text-[#9BA3BD] hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-semibold rounded-lg glass-btn-primary text-white cursor-pointer"
                      >
                        Send Invite
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Member List */}
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B7CFF] to-[#42D6E8] flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-[#8B7CFF]/20">
                        {m.avatarInitials}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F5FF]">{m.name}</div>
                        <div className="text-[11px] text-[#9BA3BD]">{m.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-[#9BA3BD] capitalize border border-white/10">
                        {m.role}
                      </span>
                      {m.status === 'invited' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Pending Invite
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Comment Input */}
              <form onSubmit={handlePostComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a review comment or legal verification note..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-white/[0.04] border border-white/15 rounded-xl text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl glass-btn-primary text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#8B7CFF]/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </form>

              {/* Comments Stream */}
              <div className="space-y-3">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      c.resolved
                        ? 'bg-white/[0.01] border-white/5 opacity-70'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F4F5FF]">{c.authorName}</span>
                        <span className="text-[10px] text-[#9BA3BD]">Page {c.pageNumber}</span>
                        <span className="text-[10px] text-[#9BA3BD]">• {c.timestamp}</span>
                      </div>
                      <button
                        onClick={() => handleToggleResolve(c.id)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
                          c.resolved
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/10 text-[#9BA3BD] border-white/15 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{c.resolved ? 'Resolved' : 'Mark Resolved'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-[#9BA3BD] leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-[#9BA3BD]">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#42D6E8]" />
            <span>Strict tenant isolation enforced across enterprise databases.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#F4F5FF] text-xs font-semibold border border-white/10 cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
