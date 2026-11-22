"use client"
/* eslint-disable @next/next/no-img-element */

import type { ImgHTMLAttributes } from "react"

const DEFAULT_FALLBACK_SRC = "/images/image-placeholder.svg"

type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string
}

export default function FallbackImage({
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  onError,
  alt = "",
  ...props
}: FallbackImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      onError={(event) => {
        const image = event.currentTarget
        if (image.src !== new URL(fallbackSrc, window.location.origin).href) {
          image.src = fallbackSrc
        }
        onError?.(event)
      }}
    />
  )
}
