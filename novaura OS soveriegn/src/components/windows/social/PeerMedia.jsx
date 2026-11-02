// PeerMedia.jsx — An image or video from someone else's post or story.
//
// Loading a remote link tells that server your IP address and when you looked,
// so media from other people's posts loads only after a click ("Load from
// example.com"). Inline images and your own posts show directly. Hosts you
// allow stay allowed until the app restarts.

import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getLocalIdentity } from '../../../services/sovereignMesh';

const allowedHosts = new Set();

function myDid() {
  const pub = String(getLocalIdentity()?.publicKey || '').replace(/^0x/, '').toLowerCase();
  return pub ? `did:nova:${pub}` : null;
}

function hostOf(src) {
  try {
    return new URL(src).host;
  } catch {
    return null;
  }
}

export default function PeerMedia({ src, kind = 'img', authorDid = null, style, mediaRef, ...rest }) {
  const host = hostOf(src);
  const inline = typeof src === 'string' && src.startsWith('data:image/');
  const own = Boolean(authorDid) && authorDid === myDid();
  const [, force] = useState(0);

  if (!src || (!inline && !host)) return null;

  if (!inline && !own && !allowedHosts.has(host)) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); allowedHosts.add(host); force(n => n + 1); }}
        title={`Loading it lets ${host} see your IP address`}
        style={{
          ...style,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
          minHeight: style?.height || '140px', background: 'rgba(15,23,42,0.85)', border: '1px dashed rgba(148,163,184,0.35)',
          borderRadius: style?.borderRadius || '8px', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', padding: '0.8rem',
        }}
      >
        <ImageOff size={18} />
        <span>{kind === 'video' ? 'Video' : 'Image'} from <strong style={{ color: '#cbd5e1' }}>{host}</strong></span>
        <span style={{ color: '#00f0ff' }}>Click to load</span>
      </button>
    );
  }

  return kind === 'video'
    ? <video ref={mediaRef} src={src} style={style} {...rest} />
    : <img ref={mediaRef} src={src} style={style} {...rest} />;
}
