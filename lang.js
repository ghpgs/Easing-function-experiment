// lang.js
export const SUPPORTED = ["ja", "en"];

export function detectLang() {
  const p = new URLSearchParams(location.search);
  let lang = p.get("lang");
  if (!SUPPORTED.includes(lang)) {
    lang = navigator.language.startsWith("ja") ? "ja" : "en";
  }
  document.documentElement.lang = lang; // <html lang="en">
  return lang;
}
