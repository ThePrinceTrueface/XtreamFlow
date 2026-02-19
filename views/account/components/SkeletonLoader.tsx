
import React from 'react';

interface SkeletonLoaderProps {
  type: 'live' | 'vod' | 'series';
  mode?: 'grid' | 'detail';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, mode = 'grid' }) => {
  return (
    <div className="w-full relative animate-in fade-in duration-500">
      {/* Styles pour l'animation de surbrillance (Shimmer) */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.05) 40%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.05) 60%,
            transparent 100%
          );
          animation: shimmer 1.5s infinite linear;
          pointer-events: none;
          z-index: 20;
        }
        .skeleton-bg {
            background-color: rgba(255,255,255,0.05);
            position: relative;
            overflow: hidden;
        }
      `}</style>

      {mode === 'detail' ? (
        <div className="p-8 md:p-12 max-w-7xl mx-auto">
             {/* Back Button Skeleton */}
             <div className="h-10 w-32 skeleton-bg rounded-full mb-8">
                 <div className="shimmer-wrapper" />
             </div>

             <div className="flex flex-col lg:flex-row gap-12 items-start">
                 {/* Left Column: Poster */}
                 <div className="w-full lg:w-[350px] shrink-0">
                     <div className="aspect-[2/3] rounded-xl skeleton-bg border border-white/5 shadow-2xl">
                         <div className="shimmer-wrapper" />
                     </div>
                     <div className="grid grid-cols-2 gap-3 mt-6">
                         <div className="h-16 rounded-lg skeleton-bg"><div className="shimmer-wrapper" /></div>
                         <div className="h-16 rounded-lg skeleton-bg"><div className="shimmer-wrapper" /></div>
                     </div>
                 </div>

                 {/* Right Column: Info */}
                 <div className="flex-1 w-full space-y-6 pt-2">
                     <div className="flex gap-3 mb-4">
                         <div className="h-6 w-20 rounded skeleton-bg"><div className="shimmer-wrapper" /></div>
                         <div className="h-6 w-32 rounded skeleton-bg"><div className="shimmer-wrapper" /></div>
                         <div className="h-6 w-24 rounded skeleton-bg"><div className="shimmer-wrapper" /></div>
                     </div>

                     <div className="h-16 w-3/4 rounded skeleton-bg mb-6"><div className="shimmer-wrapper" /></div>

                     {/* Action Buttons */}
                     <div className="flex gap-4 mb-8">
                         <div className="h-12 w-40 rounded skeleton-bg"><div className="shimmer-wrapper" /></div>
                         <div className="h-12 w-40 rounded skeleton-bg"><div className="shimmer-wrapper" /></div>
                     </div>

                     {/* Synopsis Box */}
                     <div className="h-48 w-full rounded-xl skeleton-bg mb-10"><div className="shimmer-wrapper" /></div>

                     {/* Info Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="h-20 rounded-lg skeleton-bg"><div className="shimmer-wrapper" /></div>
                         <div className="h-20 rounded-lg skeleton-bg"><div className="shimmer-wrapper" /></div>
                     </div>
                 </div>
             </div>
        </div>
      ) : (
        /* GRID MODE */
        <div className="space-y-8">
            {/* --- HERO SECTION SKELETON --- */}
            <div className="relative w-full h-[420px] mb-8 rounded-window bg-white/5 border border-white/5 overflow-hidden">
                <div className="shimmer-wrapper" />
                <div className="absolute inset-0 flex items-center px-10">
                <div className="flex gap-8 items-end max-w-4xl w-full">
                    <div className="hidden md:block w-48 shrink-0 aspect-[2/3] rounded-lg bg-white/10 border border-white/5" />
                    <div className="flex-1 pb-2 space-y-4">
                    <div className="flex gap-2">
                        <div className="h-5 w-24 bg-white/10 rounded" />
                        <div className="h-5 w-12 bg-white/10 rounded" />
                    </div>
                    <div className="h-10 w-3/4 bg-white/10 rounded-md" />
                    <div className="space-y-2 max-w-xl">
                        <div className="h-4 w-full bg-white/5 rounded" />
                        <div className="h-4 w-5/6 bg-white/5 rounded" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <div className="h-10 w-32 bg-white/10 rounded-control" />
                        <div className="h-10 w-32 bg-white/5 rounded-control" />
                    </div>
                    </div>
                </div>
                </div>
            </div>

            {/* --- GRID SECTION SKELETON --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 relative">
                {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-fluent-border rounded-window overflow-hidden relative h-full">
                    <div className="shimmer-wrapper" style={{ animationDelay: `${i * 0.05}s` }} />
                    <div className={`${type === 'live' ? 'aspect-video' : 'aspect-[2/3]'} w-full bg-white/5 relative`} />
                    <div className="p-3 space-y-2">
                    <div className="h-3 bg-white/10 rounded w-3/4" />
                    <div className="h-2 bg-white/5 rounded w-1/4" />
                    </div>
                </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};
