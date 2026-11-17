import React, { useEffect, useState } from 'react';
import {
  buildMinecraftHeadAvatarUrl,
  isMinecraftAvatarUrl,
  normalizeMinecraftUsername,
} from '../utils/skinLogic';

interface MinecraftHeadAvatarProps {
  username?: string | null;
  avatarUrl?: string | null;
  alt?: string;
  styleMode?: '2d' | '3d';
  size?: number;
  className?: string;
  initials?: string;
}

export const MinecraftHeadAvatar: React.FC<MinecraftHeadAvatarProps> = ({
  username,
  avatarUrl,
  alt = 'Minecraft skin head',
  styleMode = '2d',
  size = 128,
  className = 'h-10 w-10 rounded-md border border-zinc-700',
  initials = 'MC',
}) => {
  const [failed, setFailed] = useState(false);

  const cleanIgn = normalizeMinecraftUsername(username);
  const resolvedSrc = cleanIgn
    ? buildMinecraftHeadAvatarUrl(cleanIgn, { size, style: styleMode })
    : avatarUrl || null;

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    // Crisp fallback Steve-style pixel head SVG when offline or non-existent IGN
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative overflow-hidden bg-zinc-900 ${className}`}
      >
        <svg viewBox="0 0 8 8" shapeRendering="crispEdges" className="h-full w-full">
          <rect width="8" height="8" fill="#c6967a" />
          {/* Hair top & sides */}
          <rect x="0" y="0" width="8" height="2" fill="#3f2718" />
          <rect x="0" y="2" width="1" height="1" fill="#3f2718" />
          <rect x="7" y="2" width="1" height="1" fill="#3f2718" />
          {/* Eyes */}
          <rect x="1" y="4" width="1" height="1" fill="#ffffff" />
          <rect x="2" y="4" width="1" height="1" fill="#4f46e5" />
          <rect x="5" y="4" width="1" height="1" fill="#4f46e5" />
          <rect x="6" y="4" width="1" height="1" fill="#ffffff" />
          {/* Nose & Mouth */}
          <rect x="3" y="5" width="2" height="1" fill="#9a6449" />
          <rect x="2" y="6" width="1" height="1" fill="#6b3e28" />
          <rect x="3" y="6" width="2" height="1" fill="#7c4732" />
          <rect x="5" y="6" width="1" height="1" fill="#6b3e28" />
        </svg>
        <span className="sr-only">{initials}</span>
      </div>
    );
  }

  const pixelated = cleanIgn.length > 0 || isMinecraftAvatarUrl(resolvedSrc);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${pixelated ? 'mc-pixelated' : ''} object-cover ${className}`}
    />
  );
};
