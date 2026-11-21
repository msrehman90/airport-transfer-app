/* eslint-disable @next/next/no-img-element */
import { photoSrcSet, photoUrl, type Photo as PhotoData } from "@/lib/config";

/**
 * Responsive photo served straight from the Unsplash CDN (sized per screen).
 * Plain <img> keeps the app free of image-optimisation config and works anywhere.
 */
export function Photo({
  photo,
  sizes = "100vw",
  className,
  priority = false,
}: {
  photo: PhotoData;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={photoUrl(photo, 1200)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={["h-full w-full object-cover", className].filter(Boolean).join(" ")}
      style={{ objectPosition: photo.position ?? "50% 50%" }}
    />
  );
}
