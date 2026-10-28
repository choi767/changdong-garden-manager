export function formatRecordNote(label: string, value: string | null | undefined, separator = ""): string {
  if (!value?.trim()) return "";
  return `${separator}(${label}> ${value})`;
}
