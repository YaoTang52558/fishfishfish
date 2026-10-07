// Current entry point; the original 30-fish QA is preserved under scripts/archive.
if(process.env.FISH_CONTENT_PREVIEW_URL)process.env.FISH_CONTENT_PREVIEW_URL=new URL(process.env.FISH_CONTENT_PREVIEW_URL).origin;
await import('./verify-ocean-library.mjs');
