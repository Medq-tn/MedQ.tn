'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Send, Edit2, Trash2, Reply, X, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

interface Comment {
  id: string;
  content: string;
  userId: string;
  lectureId: string;
  createdAt: string;
  updatedAt: string;
  isAnonymous?: boolean;
  parentCommentId?: string | null;
  user?: {
  name?: string;
  email?: string;
  avatar?: string | null;
  role?: string;
  };
  replies?: Comment[];
  _count?: {
    likes?: number;
  };
}

interface LectureCommentsProps {
  lectureId: string;
}

export function LectureComments({ lectureId }: LectureCommentsProps) {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [postAnon, setPostAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [replyAnon, setReplyAnon] = useState(false); // default for new reply (legacy toggle retained)
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Likes removed

  // Load comments for this lecture
  useEffect(() => {
    const loadComments = async () => {
      if (!lectureId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/comments?lectureId=${lectureId}`);
        if (response.ok) {
          const commentsData = await response.json();
          setComments(commentsData);
          // infer liked status not available yet
        } else {
          console.error('Failed to load comments');
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [lectureId]);

  const optimisticAdd = (comment: Comment) => {
    setComments(prev => [comment, ...prev]);
  };

  const handleSubmitComment = async () => {
    if (!user?.id || !newComment.trim()) {
      toast({
        title: "Error",
        description: "Please sign in and enter a comment.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const body = {
        content: newComment.trim(),
        userId: user.id,
        lectureId,
        isAnonymous: postAnon,
      };
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        optimisticAdd(newCommentData);
        setNewComment('');
        setPostAnon(false);
        toast({
          title: "Comment Added",
          description: "Your comment has been posted.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to post comment.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReply = async (content: string, isAnon: boolean, parent: Comment) => {
    if (!user?.id || !content.trim()) return;
    try {
      const body = { content: content.trim(), userId: user.id, lectureId, parentCommentId: parent.id, isAnonymous: isAnon };
      const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) {
        const newReply = await response.json();
        const rootId = findRootId(parent);
        const insert = (node: Comment): Comment => {
          if (node.id === parent.id) return { ...node, replies: [newReply, ...(node.replies || [])] };
          return { ...node, replies: node.replies?.map(r => insert(r)) };
        };
        setComments(prev => prev.map(c => c.id === rootId ? insert(c) : c));
        toast({ title: 'Reply Added', description: 'Your reply has been posted.' });
        setReplyTo(null);
        setReplyAnon(false);
      } else {
        const errorData = await response.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to post reply.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to post reply.', variant: 'destructive' });
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      });

      if (response.ok) {
        const updatedComment = await response.json();
        setComments(prev => prev.map(c => {
          if (c.id === commentId) return { ...c, ...updatedComment };
          return { ...c, replies: c.replies?.map(r => r.id === commentId ? { ...r, ...updatedComment } : r) };
        }));
        setEditingComment(null);
        setEditContent('');
        toast({
          title: "Comment Updated",
          description: "Your comment has been updated.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to update comment.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to update comment.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (response.ok) {
        setComments(prev => prev
          .filter(c => c.id !== commentId)
          .map(c => ({ ...c, replies: c.replies?.filter(r => r.id !== commentId) }))
        );
        toast({ title: 'Comment Deleted', description: 'The comment has been deleted successfully.' });
      } else {
        const errorData = await response.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to delete comment.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete comment.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleAdminDeleteComment = handleDeleteComment; // same behavior for now

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };
  const cancelEditing = () => { setEditingComment(null); setEditContent(''); };

  const getUserInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return 'AN';
  };

  const displayName = (c: Comment) => {
    if (c.isAnonymous) return 'Anonymous';
    return c.user?.name || c.user?.email || 'User';
  };

  // toggleLike removed

  const findRootId = (target: Comment): string => {
    if (!target.parentCommentId) return target.id;
    // recursive search
    for (const root of comments) {
      if (root.id === target.id) return root.id;
      const stack: Comment[] = [...(root.replies || [])];
      while (stack.length) {
        const current = stack.shift()!;
        if (current.id === target.id) return root.id;
        if (current.replies) stack.push(...current.replies);
      }
    }
    return target.parentCommentId; // fallback
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign in to view comments</h3>
          <p className="text-muted-foreground">
            Join the discussion by signing in to your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const isOwner = comment.userId === user.id;
    const isEdited = comment.createdAt !== comment.updatedAt;
  // likes removed
    return (
      <div className={`group flex gap-3 p-4 rounded-xl border bg-background/40 hover:bg-background/70 transition-colors ${depth > 0 ? 'ml-10 mt-2' : ''}`}>        
        <Avatar className="h-10 w-10 ring-2 ring-background/60">
          {!comment.isAnonymous && <AvatarImage src={comment.user?.avatar || undefined} />}
          <AvatarFallback>{comment.isAnonymous ? 'AN' : getUserInitials(comment.user?.name, comment.user?.email)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium truncate max-w-[160px]">{displayName(comment)}</span>
            {!comment.isAnonymous && (comment.user?.role === 'admin' || (isOwner && isAdmin)) && (
              <span className="px-1.5 py-0.5 text-[10px] tracking-wide bg-blue-500/15 text-blue-500 rounded-full">ADMIN</span>
            )}
            <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
            {isEdited && <span className="text-[10px] text-muted-foreground">(edited)</span>}
          </div>
          {editingComment === comment.id ? (
            <div className="mt-2 space-y-2">
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[70px] text-sm" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" onClick={() => handleEditComment(comment.id)} disabled={!editContent.trim()}>Save</Button>
                <Button size="sm" variant="outline" onClick={cancelEditing}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
          )}
          <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isOwner && editingComment !== comment.id && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(comment)} title="Edit"><Edit2 className="h-3.5 w-3.5" /></Button>
            )}
            {(isOwner || isAdmin) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteTarget(comment)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete comment</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently remove the comment{comment.replies && comment.replies.length > 0 ? ' and its replies' : ''}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={isDeleting} onClick={() => deleteTarget && handleDeleteComment(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* likes removed */}
            {/* reply button only for top-level comments (depth 0) to enforce single-level replies */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setReplyTo(comment); setReplyAnon(false); }}
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </Button>
            {/* admin identity reveal badge for anonymous */}
            {comment.isAnonymous && isAdmin && !isOwner && comment.user?.name && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600"><Shield className="h-3 w-3" />{comment.user.name}</span>
            )}
          </div>
          {replyTo?.id === comment.id && (
            <InlineReplyEditor
              key={comment.id}
              parent={comment}
              defaultAnon={replyAnon}
              onCancel={() => { setReplyTo(null); setReplyAnon(false); }}
              onSubmit={(content, anon) => submitReply(content, anon, comment)}
            />
          )}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-2">
              {comment.replies.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(r => (
                <CommentItem key={r.id} comment={r} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"><MessageCircle className="h-4 w-4" /></span>
          <span>Discussion</span>
          <span className="ml-1 text-sm font-medium text-muted-foreground">({comments.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 pt-0">
        <div className="rounded-xl border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50 p-4 shadow-sm space-y-3">
          <Textarea
            placeholder="Share your thoughts about this lecture..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                e.preventDefault();
                if (!isSubmitting) handleSubmitComment();
              }
            }}
            className="min-h-[90px] resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <Checkbox checked={postAnon} onCheckedChange={v => setPostAnon(Boolean(v))} className="h-4 w-4" />
              <span>Post anonymously</span>
            </label>
            <Button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmitting} size="sm" className="gap-1">
              <Send className="h-3.5 w-3.5" />
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 p-4 rounded-xl border bg-background/40 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 rounded-xl border bg-background/40">
            <div className="h-14 w-14 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h3 className="font-semibold mb-1">No comments yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Be the first to share your insight or ask a question about this lecture.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map(c => <CommentItem key={c.id} comment={c} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Isolated inline reply editor component to prevent focus loss due to parent re-renders
interface InlineReplyEditorProps {
  parent: Comment;
  onSubmit: (content: string, anon: boolean) => void;
  onCancel: () => void;
  defaultAnon?: boolean;
}

function InlineReplyEditor({ parent, onSubmit, onCancel, defaultAnon }: InlineReplyEditorProps) {
  const [value, setValue] = useState('');
  const [anon, setAnon] = useState(!!defaultAnon);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Replying to {parent.isAnonymous ? 'Anonymous' : parent.user?.name || 'User'}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" />Cancel
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSubmit(value, anon);
          }
        }}
        placeholder="Write a reply..."
        className="min-h-[70px] text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox checked={anon} onCheckedChange={v => setAnon(Boolean(v))} className="h-4 w-4" />
          <span>Post anonymously</span>
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => { if (value.trim()) onSubmit(value, anon); }} disabled={!value.trim()}>Reply</Button>
        </div>
      </div>
    </div>
  );
}
