import React from "react";

/* The tangram bird as vector geometry, traced from the master artwork:
   each triangle below is the exact convex hull of one coloured region, mapped
   into a 550x432 box. Unlike the PNG tile this carries no background, so it can
   sit on any surface at any scale — used large as decoration on the auth pages
   and anywhere a flat-colour version is wanted.

   `tone`: "brand" keeps the original six colours, "mono" paints every piece in
   currentColor so it can sit quietly behind content. */
export default function DhiMark({ tone = "brand", className = "", ...rest }) {
  const mono = tone === "mono";
  const fill = (color) => (mono ? "currentColor" : color);
  return (
    <svg
      viewBox="0 0 550 432"
      className={className}
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      <polygon points="1,0 226.6,0 226.6,228.5" fill={fill("#EF94CA")} />
      <polygon points="245.6,1 457.2,213.5 241.6,429" fill={fill("#7ED957")} />
      <polygon points="365.3,99.8 464.2,1 462.2,197.5" fill={fill("#5CE7FF")} />
      <polygon points="132.8,429 227.6,335.2 227.6,429" fill={fill("#FC6467")} />
      <polygon points="479.1,1 547,69.8 479.1,69.8" fill={fill("#FFE533")} />
    </svg>
  );
}
