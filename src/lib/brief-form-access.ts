/** Clients and unauthenticated public visitors may submit; staff may not. */
export function canSubmitBriefForm(publicView: boolean, showCopyAction: boolean): boolean {
  return publicView || !showCopyAction
}
