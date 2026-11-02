// SocialProfileModal.jsx — User Profile Dossier (Banner, Karma, Follow & History)
import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, UserPlus, UserCheck, Shield, Sparkles,
  TrendingUp, Video, Users, Globe, Award, Calendar, Hash
} from 'lucide-react';
import {
  getSocialProfile, getFeed, toggleFollowUser, isFollowingUser
} from '../../../services/sovereignMesh';
import FeedPostCard from './FeedPostCard';

export default function SocialProfileModal({ handle, onClose }) {
  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [activeProfileTab, setActiveProfileTab] = useState('all'); // 'all' | 'videos' | 'discussions'

  useEffect(() => {
    const myProfile = getSocialProfile();
    const isSelf = !handle || handle === myProfile.handle;

    // Another node's profile is built from its signed posts on this node; its
    // follower counts live on its own node, so they are not shown here.
    const theirPosts = isSelf ? [] : getFeed('all', 'all', 'new').filter(p => p.authorHandle === handle);
    const latest = theirPosts[0];
    const theirKarma = theirPosts.reduce((n, p) => n + (p.upvotes || 0) - (p.downvotes || 0), 0);
    const targetProfile = isSelf ? myProfile : {
      handle,
      displayName: latest?.authorName || handle,
      bio: '',
      avatarColor: latest?.authorColor || '#94a3b8',
      bannerUrl: null,
      followers: null,
      following: null,
      karma: theirKarma,
      postKarma: theirKarma,
      commentKarma: null,
      verifiedNode: Boolean(latest?.authorDid),
      nodeId: latest?.authorDid || null,
    };

    setProfile(targetProfile);
    setIsFollowing(isFollowingUser(targetProfile.handle));

    // Get posts by this author
    const allPosts = getFeed('all', 'all');
    const filtered = allPosts.filter(p => p.authorHandle === targetProfile.handle);
    setUserPosts(filtered);
  }, [handle]);

  const handleFollowToggle = () => {
    if (!profile) return;
    const nextState = toggleFollowUser(profile.handle, profile.nodeId);
    setIsFollowing(nextState);
    setProfile(prev => ({
      ...prev,
      followers: nextState ? (prev.followers || 0) + 1 : Math.max(0, (prev.followers || 1) - 1),
    }));
  };

  if (!profile) return null;

  const displayPosts = userPosts.filter(p => {
    if (activeProfileTab === 'videos') return p.type === 'video';
    if (activeProfileTab === 'discussions') return p.type === 'reddit';
    return true;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(5,7,15,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(16px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '680px',
          maxWidth: '94vw',
          maxHeight: '92vh',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(0,240,255,0.35)',
          borderRadius: '16px',
          overflowY: 'auto',
          boxShadow: '0 0 50px rgba(0,240,255,0.25)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Cover Banner */}
        <div
          style={{
            height: '140px',
            width: '100%',
            background: profile.bannerUrl
              ? `url(${profile.bannerUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #090e1f 0%, #0369a1 40%, #a855f7 100%)',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Card Header */}
        <div style={{ padding: '0 1.5rem 1rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
          {/* Avatar & Follow Button Row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-45px', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                backgroundColor: profile.avatarColor || '#00f0ff',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '2rem',
                border: '4px solid #0f172a',
                boxShadow: '0 0 20px rgba(0,240,255,0.4)',
                position: 'relative',
              }}
            >
              {profile.displayName?.[0] || 'O'}
              <div
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #0f172a',
                }}
                title="Active Mesh Node Online"
              />
            </div>

            <button
              onClick={handleFollowToggle}
              style={{
                padding: '0.45rem 1.1rem',
                borderRadius: '20px',
                border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
                backgroundColor: isFollowing ? 'rgba(255,255,255,0.1)' : '#0284c7',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: isFollowing ? 'none' : '0 0 15px rgba(2,132,199,0.4)',
              }}
            >
              {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isFollowing ? 'Ally Node (Following)' : 'Follow Node'}</span>
            </button>
          </div>

          {/* User Name & Handle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                {profile.displayName}
              </h2>
              <CheckCircle2 size={16} color="#22d3ee" />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace", marginTop: '2px' }}>
              @{profile.handle}.nova
            </div>
          </div>

          {/* Bio */}
          <p style={{ margin: '0.65rem 0 0.85rem', fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {profile.bio}
          </p>

          {/* Stats Bar (Karma, Followers, Following) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '0.5rem',
              backgroundColor: 'rgba(2,6,23,0.7)',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>SWARM KARMA</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f59e0b' }}>{profile.karma || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>POST KARMA</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#10b981' }}>{profile.postKarma || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>FOLLOWERS</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#00f0ff' }}>{profile.followers ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>FOLLOWING</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#c084fc' }}>{profile.following ?? '—'}</div>
            </div>
          </div>

        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 1.5rem', backgroundColor: 'rgba(11,19,43,0.5)' }}>
          {[
            { id: 'all', label: `All Transmissions (${userPosts.length})`, icon: Users },
            { id: 'videos', label: `AuraTube (${userPosts.filter(p => p.type === 'video').length})`, icon: Video },
            { id: 'discussions', label: `Discussions (${userPosts.filter(p => p.type === 'reddit').length})`, icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveProfileTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeProfileTab === tab.id ? '2px solid #00f0ff' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeProfileTab === tab.id ? '#00f0ff' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.84rem' }}>
              No sovereign transmissions published in this tab yet.
            </div>
          ) : (
            displayPosts.map(post => (
              <FeedPostCard
                key={post.id}
                post={post}
                onRefresh={() => {}}
                onOpenProfile={() => {}}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
