export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatarInitials: string;
  status: 'active' | 'invited';
}

export interface DocumentCommentItem {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  pageNumber: number;
  timestamp: string;
  resolved: boolean;
}

const COLLAB_STORAGE_KEY = 'omnidoc_team_collaboration_v2';

export class CollaborationService {
  public getTeamMembers(): TeamMember[] {
    try {
      const stored = localStorage.getItem(COLLAB_STORAGE_KEY + '_members');
      if (stored) return JSON.parse(stored);
    } catch {}

    const defaults: TeamMember[] = [
      { id: 'm1', name: 'Albin Architect', email: 'albin@omnidoc.io', role: 'owner', avatarInitials: 'AA', status: 'active' },
      { id: 'm2', name: 'Elena Rostova', email: 'elena.rostova@enterprise.corp', role: 'editor', avatarInitials: 'ER', status: 'active' },
      { id: 'm3', name: 'Marcus Chen', email: 'marcus.chen@fintech.net', role: 'viewer', avatarInitials: 'MC', status: 'invited' },
    ];
    return defaults;
  }

  public addTeamMember(name: string, email: string, role: 'admin' | 'editor' | 'viewer'): TeamMember {
    const members = this.getTeamMembers();
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'TM';
    const newMember: TeamMember = {
      id: `member_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      avatarInitials: initials,
      status: 'invited',
    };
    members.push(newMember);
    localStorage.setItem(COLLAB_STORAGE_KEY + '_members', JSON.stringify(members));
    return newMember;
  }

  public getDocumentComments(docId: string = 'active'): DocumentCommentItem[] {
    try {
      const stored = localStorage.getItem(COLLAB_STORAGE_KEY + `_comments_${docId}`);
      if (stored) return JSON.parse(stored);
    } catch {}

    return [
      {
        id: 'c1',
        authorName: 'Elena Rostova',
        authorEmail: 'elena@enterprise.corp',
        content: 'Please verify section 4.2 liability cap matches the master framework agreement ($1M USD).',
        pageNumber: 2,
        timestamp: '10 mins ago',
        resolved: false,
      },
      {
        id: 'c2',
        authorName: 'Albin Architect',
        authorEmail: 'albin@omnidoc.io',
        content: 'Verified and reconciled with legal team. Redaction applied on banking account numbers.',
        pageNumber: 4,
        timestamp: 'Just now',
        resolved: true,
      },
    ];
  }

  public addComment(docId: string, content: string, pageNumber: number = 1): DocumentCommentItem {
    const comments = this.getDocumentComments(docId);
    const newComment: DocumentCommentItem = {
      id: `comment_${Date.now()}`,
      authorName: 'You (Current User)',
      authorEmail: 'user@omnidoc.io',
      content: content.trim(),
      pageNumber,
      timestamp: 'Just now',
      resolved: false,
    };
    comments.unshift(newComment);
    localStorage.setItem(COLLAB_STORAGE_KEY + `_comments_${docId}`, JSON.stringify(comments));
    return newComment;
  }

  public toggleCommentResolved(docId: string, commentId: string): void {
    const comments = this.getDocumentComments(docId);
    const target = comments.find(c => c.id === commentId);
    if (target) {
      target.resolved = !target.resolved;
      localStorage.setItem(COLLAB_STORAGE_KEY + `_comments_${docId}`, JSON.stringify(comments));
    }
  }
}

export const collaborationService = new CollaborationService();
