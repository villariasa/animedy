// Shared open/closed state for the global feedback modal, so any menu or
// button can summon it.

class FeedbackModalStore {
  open = $state(false);
}

export const feedbackModal = new FeedbackModalStore();
