// CommentTree.jsx — Recursive Reddit-Style Multi-Tier Nested Comment Tree
import React, { useState } from 'react';
import {
  ThumbsUp, ThumbsDown, MessageSquare, CornerDownRight, Sparkles,
  ChevronDown, ChevronRight, Send, UserCheck, Shield
} from 'lucide-react';
import { voteComment, addComment } from '../../../services/sovereignMesh';
import { generateSmartReply } from '../../../services/socialAiService';

const DEPTH_COLORS = [
  '#00f0ff', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
];

function CommentNode({
  comment,
  postId,
  postAuthorHandle,
  depth = 0,
  onRefresh,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const isOp = comment.authorHandle === postAuthorHandle;
  const depthColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const replies = comment.replies || [];
  const score = (comment.upvotes || 0) - (comment.downvotes || 0);

  const handleVote = (dir) => {
    voteComment(postId, comment.id, dir);
    if (onRefresh) onRefresh();
  };

  const handleSendReply = () => {
    if (!replyInput.trim()) return;
    addComment(postId, replyInput, comment.id);
    setReplyInput('');
    setShowReplyBox(false);
    if (onRefresh) onRefresh();
  };

  const handleAiAssistedReply = async () => {
    setIsGeneratingAi(true);
    try {
      const generated = await generateSmartReply({
        post: { id: postId, subAura: 'r/general' },
        comments: [comment],
        tone: 'insightful',
      });
      if (generated) setReplyInput(generated);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        marginLeft: depth > 0 ? '1rem' : '0',
        marginTop: '0.45rem',
      }}
    >
      {/* Left Vertical Thread Line for nested comments */}
      {depth > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '-10px',
            top: '0',
            bottom: '0',
            width: '2px',
            backgroundColor: depthColor,
            opacity: 0.35,
          }}
        />
      )}

      {/* Main Comment Card */}
      <div
        style={{
          backgroundColor: depth % 2 === 0 ? 'rgba(15,23,42,0.6)' : 'rgba(11,19,43,0.5)',
          borderRadius: '8px',
          padding: '0.65rem 0.85rem',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Comment Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* Collapse/Expand Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              title={isCollapsed ? 'Expand comment thread' : 'Collapse comment thread'}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Author Avatar */}
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: comment.authorColor || depthColor,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.65rem',
              }}
            >
              {comment.authorName?.[0] || 'U'}
            </div>

            {/* Author Info & OP Badge */}
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f1f5f9' }}>
              {comment.authorName}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
              @{comment.authorHandle}.nova
            </span>

            {isOp && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(0,240,255,0.2)',
                  color: '#00f0ff',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '3px',
                  border: '1px solid rgba(0,240,255,0.4)',
                }}
              >
                OP
              </span>
            )}

            <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
              • {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Collapsed Count Badge */}
          {isCollapsed && replies.length > 0 && (
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>
              +{replies.length} child replies collapsed
            </span>
          )}
        </div>

        {/* Comment Body & Actions if not collapsed */}
        {!isCollapsed && (
          <>
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '0.45rem' }}>
              {comment.content}
            </div>

            {/* Karma & Reply Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              
              {/* Comment Up/Down Karma */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(2,6,23,0.5)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                <button
                  onClick={() => handleVote('up')}
                  style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  title="Upvote comment"
                >
                  <ThumbsUp size={11} />
                </button>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: score >= 0 ? '#10b981' : '#ef4444', minWidth: '12px', textAlign: 'center' }}>
                  {score}
                </span>
                <button
                  onClick={() => handleVote('down')}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  title="Downvote comment"
                >
                  <ThumbsDown size={11} />
                </button>
              </div>

              {/* Reply Trigger */}
              <button
                onClick={() => setShowReplyBox(!showReplyBox)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: showReplyBox ? '#00f0ff' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.72rem',
                }}
              >
                <CornerDownRight size={12} />
                <span>Reply</span>
              </button>
            </div>

            {/* Nested Reply Composer */}
            {showReplyBox && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', borderRadius: '6px', border: '1px solid rgba(0,240,255,0.2)' }}>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <input
                    value={replyInput}
                    onChange={e => setReplyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                    placeholder={`Reply to @${comment.authorHandle}...`}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.6rem',
                      backgroundColor: 'rgba(15,23,42,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '5px',
                      color: '#f8fafc',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#0284c7',
                      border: 'none',
                      borderRadius: '5px',
                      color: '#fff',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Send size={11} />
                    <span>Post</span>
                  </button>
                </div>

                {/* AI Smart Suggestion Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleAiAssistedReply}
                    disabled={isGeneratingAi}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c084fc',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Sparkles size={11} />
                    <span>{isGeneratingAi ? 'Synthesizing...' : '✨ AI Smart Suggestion'}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recursive Render for Child Replies */}
      {!isCollapsed && replies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {replies.map(child => (
            <CommentNode
              key={child.id}
              comment={child}
              postId={postId}
              postAuthorHandle={postAuthorHandle}
              depth={depth + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentTree({
  postId,
  postAuthorHandle,
  comments = [],
  onRefresh,
}) {
  const [topInput, setTopInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleAddTopComment = () => {
    if (!topInput.trim()) return;
    addComment(postId, topInput);
    setTopInput('');
    if (onRefresh) onRefresh();
  };

  const handleAiSmartReply = async () => {
    setIsGeneratingAi(true);
    try {
      const generated = await generateSmartReply({
        post: { id: postId, subAura: 'r/general' },
        comments,
        tone: 'insightful',
      });
      if (generated) setTopInput(generated);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
      
      {/* Top-level Comment Composer */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <input
            value={topInput}
            onChange={e => setTopInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTopComment()}
            placeholder="Contribute to this sovereign discussion thread..."
            style={{
              flex: 1,
              padding: '0.5rem 0.8rem',
              backgroundColor: 'rgba(2,6,23,0.85)',
              border: '1px solid rgba(0,240,255,0.25)',
              borderRadius: '7px',
              color: '#f8fafc',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddTopComment}
            style={{
              padding: '0.5rem 0.95rem',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '7px',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Send size={13} />
            <span>Comment</span>
          </button>
        </div>

        {/* AI Smart Suggestion Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleAiSmartReply}
            disabled={isGeneratingAi}
            style={{
              background: 'none',
              border: 'none',
              color: '#c084fc',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Sparkles size={12} />
            <span>{isGeneratingAi ? 'Synthesizing with Local AI...' : '✨ AI Smart Reply Draft'}</span>
          </button>
        </div>
      </div>

      {/* Comment List Tree */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.78rem' }}>
          No peer comments in this thread yet. Be the first sovereign node to reply!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comments.map(c => (
            <CommentNode
              key={c.id}
              comment={c}
              postId={postId}
              postAuthorHandle={postAuthorHandle}
              depth={0}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

    </div>
  );
}
