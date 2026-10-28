// Franchise graph walker: walks AniList relations (PREQUEL/SEQUEL primarily)
// to compute franchise_key + sequence_order, persists anime + anime_relations.
// See PRD.md §6.

import { query } from "../../lib/dbconn.js";
import { logError } from "../../lib/errorlogger.js";
import type { AnimeRow, RelationType } from "../interfaces/db.js";
import type { AniListFuzzyDate, AniListMedia, AniListRelationType } from "../interfaces/external.js";
import { INSERT_ANIME_RELATION } from "../queries/anime.js";
import { fetchAniListMediaById, mapAniListMediaToAnimeInput } from "./anilist.js";
import { upsertAnimeInput } from "./metadata.js";

function toTimestamp(date: AniListFuzzyDate): number {
  if (!date.year) {
    return Number.MAX_SAFE_INTEGER;
  }
  return new Date(date.year, (date.month ?? 1) - 1, date.day ?? 1).getTime();
}

function deriveSeasonLabel(media: AniListMedia, positionInChain: number): string | null {
  const title = media.title.english ?? media.title.romaji ?? "";
  if (/final season/i.test(title)) {
    return "Final Season";
  }
  const seasonMatch = /season\s*(\d+)/i.exec(title);
  const partMatch = /part\s*(\d+)/i.exec(title);
  if (seasonMatch && partMatch) {
    return `Season ${seasonMatch[1]} Part ${partMatch[1]}`;
  }
  if (seasonMatch) {
    return `Season ${seasonMatch[1]}`;
  }
  if (partMatch) {
    return `Part ${partMatch[1]}`;
  }
  if (media.format === "MOVIE") {
    return "Movie";
  }
  if (media.format === "OVA") {
    return "OVA";
  }
  if (media.format === "SPECIAL") {
    return "Special";
  }
  return `Season ${positionInChain + 1}`;
}

/**
 * Walks backward along PREQUEL edges from the given media to find the
 * franchise root, fetching relation data as needed. Bounded loop guards
 * against malformed cyclic relation graphs.
 */
async function findFranchiseRoot(startMedia: AniListMedia): Promise<AniListMedia> {
  let current = startMedia.relations ? startMedia : await fetchAniListMediaById(startMedia.id, true);
  const visited = new Set<number>([current.id]);

  for (let hops = 0; hops < 25; hops += 1) {
    const prequelEdge = current.relations?.edges.find((edge) => edge.relationType === "PREQUEL");
    if (!prequelEdge || visited.has(prequelEdge.node.id)) {
      break;
    }
    visited.add(prequelEdge.node.id);
    current = await fetchAniListMediaById(prequelEdge.node.id, true);
  }

  return current;
}

interface SideEdge {
  fromAnilistId: number;
  toMedia: AniListMedia;
  relationType: AniListRelationType;
}

/**
 * Walks forward from the franchise root along SEQUEL edges to build the
 * main chain, collecting non-prequel/sequel relations (movies, specials,
 * spin-offs, etc.) as side edges.
 */
async function buildForwardChain(
  root: AniListMedia,
): Promise<{ chain: AniListMedia[]; sideEdges: SideEdge[] }> {
  const chain: AniListMedia[] = [];
  const sideEdges: SideEdge[] = [];
  const seen = new Set<number>();
  const pending: AniListMedia[] = [root];

  while (pending.length > 0) {
    const next = pending.shift();
    if (!next || seen.has(next.id)) {
      continue;
    }
    seen.add(next.id);
    const full = next.relations ? next : await fetchAniListMediaById(next.id, true);
    chain.push(full);

    for (const edge of full.relations?.edges ?? []) {
      if (edge.relationType === "SEQUEL" && !seen.has(edge.node.id)) {
        pending.push(edge.node);
      } else if (edge.relationType !== "PREQUEL" && edge.relationType !== "SEQUEL") {
        sideEdges.push({ fromAnilistId: full.id, toMedia: edge.node, relationType: edge.relationType });
      }
    }
  }

  chain.sort((a, b) => toTimestamp(a.startDate) - toTimestamp(b.startDate));
  return { chain, sideEdges };
}

function toRelationTypeDb(type: AniListRelationType): RelationType {
  return type as RelationType;
}

/**
 * Walks the full franchise graph starting from any media node, persists
 * every discovered entry into `anime` with a shared franchise_key +
 * sequence_order, records relation edges in `anime_relations`, and returns
 * the computed franchise_key.
 */
export async function walkAndPersistFranchise(startMedia: AniListMedia): Promise<string> {
  try {
    const root = await findFranchiseRoot(startMedia);
    const franchiseKey = String(root.id);
    const { chain, sideEdges } = await buildForwardChain(root);

    const idByAnilistId = new Map<number, number>();

    for (const [i, media] of chain.entries()) {
      const input = mapAniListMediaToAnimeInput(media);
      input.franchise_key = franchiseKey;
      input.sequence_order = i + 1;
      input.season_label = deriveSeasonLabel(media, i);
      const row: AnimeRow = await upsertAnimeInput(input);
      idByAnilistId.set(media.id, row.id);
    }

    let sideOrder = chain.length + 1;
    for (const side of sideEdges) {
      if (idByAnilistId.has(side.toMedia.id)) {
        continue;
      }
      const input = mapAniListMediaToAnimeInput(side.toMedia);
      input.franchise_key = franchiseKey;
      input.sequence_order = sideOrder;
      sideOrder += 1;
      const row: AnimeRow = await upsertAnimeInput(input);
      idByAnilistId.set(side.toMedia.id, row.id);
    }

    for (let i = 0; i < chain.length - 1; i += 1) {
      const currentNode = chain[i];
      const nextNode = chain[i + 1];
      if (!currentNode || !nextNode) {
        continue;
      }
      const fromId = idByAnilistId.get(currentNode.id);
      const toId = idByAnilistId.get(nextNode.id);
      if (fromId && toId) {
        await query(INSERT_ANIME_RELATION, [fromId, toId, "SEQUEL"]);
        await query(INSERT_ANIME_RELATION, [toId, fromId, "PREQUEL"]);
      }
    }

    for (const side of sideEdges) {
      const fromId = idByAnilistId.get(side.fromAnilistId);
      const toId = idByAnilistId.get(side.toMedia.id);
      if (fromId && toId) {
        await query(INSERT_ANIME_RELATION, [fromId, toId, toRelationTypeDb(side.relationType)]);
      }
    }

    return franchiseKey;
  } catch (err) {
    await logError("franchise.walkAndPersistFranchise", err);
    throw err;
  }
}
