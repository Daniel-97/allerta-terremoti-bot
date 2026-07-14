// Escapes only & < > — sufficient for HTML tag content and for the static
// href values used in this codebase. If a future caller interpolates a
// dynamic value into an HTML attribute (e.g. href="..."), it must also
// escape " and '.
export function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
