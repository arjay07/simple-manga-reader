/**
 * Comparator for ordering volumes within a panel-detection queue.
 *
 * Volumes are processed in ascending `volume_number`. Volumes whose number is
 * unknown (`null`) sort last so they don't jump ahead of properly-numbered ones.
 */
export function compareVolumeOrder(
  a: { volume_number: number | null },
  b: { volume_number: number | null },
): number {
  if (a.volume_number === null && b.volume_number === null) return 0;
  if (a.volume_number === null) return 1;
  if (b.volume_number === null) return -1;
  return a.volume_number - b.volume_number;
}
