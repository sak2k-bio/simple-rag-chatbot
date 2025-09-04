# Retrieval Optimization Guide

This document explains the retrieval optimization pipeline implemented in `src/app/api/chat/route.ts`, how to tune it, and how to interpret the logs during development.

## Goals

- Reduce citation/reference-only passages in context
- Improve answerable-passage density
- Keep context concise (<= 10 sources) while maintaining coverage
- Provide clear logging for debugging and tuning

## Key Techniques

- Dynamic combined-score cutoff: keep items within 85% of the top combined score
- Cosine score floor: `max(user threshold, 0.10)`
- Reference penalty boost (reduces citation-heavy blocks)
- Metadata/title overlap boost (small)
- Acronym-aware boost for uppercase tokens (e.g., `ILD`, `SBRT`)
- Context cap: 10 sources
- Optional MMR for diversity and optional cross-encoder re-ranking

## Parameters and Weights

- Combined score weights (approx):
  - Vector cosine: `0.65` (hybrid on) or `0.75` (hybrid off)
  - Keyword overlap: `0.35` (hybrid on) or `0.18` (hybrid off)
  - BM25-ish term: `0.20` when hybrid is ON, else `0.00`
  - Metadata/title boost: up to `~0.25 * keywordOverlap(title)`
  - Acronym boost: `+0.10` if any exact uppercase token appears in text
  - Reference penalty: `-0.35 * refPenalty`, where `refPenalty ∈ [0..1]`

- Dynamic filter:
  - Relative cutoff: `0.85 * topCombined`
  - Cosine floor: `>= 0.10`
  - Min keyword overlap: `0.15` (Hybrid ON) or `0.05` (Hybrid OFF)

- Context cap: `min(10, finalTopK)`, but never below 8

## How to Run Experiments

Use the following presets with the same query to compare behavior:

1. Baseline
   - `hybridEnabled=false, mmrEnabled=false, crossEncoderEnabled=false`
2. Hybrid + MMR
   - `hybridEnabled=true, mmrEnabled=true, crossEncoderEnabled=false`
3. Hybrid + MMR + Cross-encoder
   - `hybridEnabled=true, mmrEnabled=true, crossEncoderEnabled=true`

Suggested UI parameters:
- Similarity Threshold: `0.08–0.12` (start `0.10`)
- Top-K: `10–12`

## Interpreting Logs

Watch these lines in your server console during a request to `/api/chat`:

- Dynamic filter summary
```
Dynamic filter: topCombined=0.7421, rel>=0.6308, cosineFloor>=0.1000, minKw=0.15. Kept 14/32
```

- Post-rerank/diversity summary
```
Post-rerank counts — optimized: 32, passing dynamic filter: 14, diversified: 12, finalUsed: 10 (cap=10)
```

- Optional MMR/cross-encoder indicators
```
Applied MMR selection, count: 12
Applied cross-encoder reranking to 20 items
```

## Tuning Tips

- If you still see reference-heavy snippets:
  - Increase reference penalty (e.g., to `-0.40`)
  - Raise `minKwOverlap` (e.g., `0.20` when Hybrid ON)
- If context is too thin:
  - Lower similarity threshold to `0.08`
  - Reduce relative cutoff slightly (e.g., `0.80`)
- For acronym-heavy queries (e.g., medical abbreviations):
  - Keep Hybrid ON
  - Ensure the acronym appears in the text; the boost helps retain them

## Source Visibility

- The UI shows all retrieved sources and marks which were used.
- Enable `structuredStreamEnabled=true` to receive a final JSONL `sources` event with `used` flags.

## File References

- API route: `src/app/api/chat/route.ts`
- Prompt helpers: `src/lib/prompt.ts`
- Qdrant search wrapper: `src/lib/qdrant.ts`

---

If you need help tuning for your corpus, share the two log lines (Dynamic filter, Post-rerank counts) and 2–3 snippet previews; we can adjust weights live.
