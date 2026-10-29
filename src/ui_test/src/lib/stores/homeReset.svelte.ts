/** Bumped whenever the user clicks "Home" so Home.svelte can clear its
 * search/filter state even when already on the home route (same-route nav
 * doesn't change `router.current`, so a plain route watch wouldn't fire). */
class HomeResetStore {
  token = $state(0);

  trigger(): void {
    this.token++;
  }
}

export const homeReset = new HomeResetStore();
