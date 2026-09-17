"use client";

// Remembers which surface (explore grid, board grid, similar rail) a post was opened from, so the
// detail view can reuse that surface's layoutId and "grow" out of the exact thumbnail that was clicked.
let lastScope = "grid";

export const setOpenScope = (scope: string) => {
  lastScope = scope;
};

export const getOpenScope = () => lastScope;
