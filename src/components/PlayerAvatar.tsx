import type { ReactNode } from "react";
import type { PhotoCrop } from "@/lib/types";
import { DEFAULT_PHOTO_CROP } from "@/lib/players";

export function PlayerAvatar({
  url,
  crop,
  name,
  fallback,
  className = "h-28 w-28 rounded-full",
}: {
  url?: string | null;
  crop?: PhotoCrop | null;
  name: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const c = crop ?? DEFAULT_PHOTO_CROP;
  const z = c.zoom;
  const shape = /\brounded-/.test(className) ? "" : "rounded-full";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border-4 border-gold bg-blue-deep ${shape} ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none object-cover"
          style={{
            width: `${z * 100}%`,
            height: `${z * 100}%`,
            transform: `translate(calc(-50% + ${c.x}%), calc(-50% + ${c.y}%))`,
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[clamp(0.7rem,40%,1.75rem)] font-bold text-gold-soft">
          {fallback ?? name.slice(0, 1)}
        </div>
      )}
    </div>
  );
}
