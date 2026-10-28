/** Ambient full-page background driven by the hero carousel's active image.
 * The carousel is the single writer; AmbientBackground is the single reader. */
class AmbienceStore {
  image = $state<string | null>(null);
}

export const ambience = new AmbienceStore();
