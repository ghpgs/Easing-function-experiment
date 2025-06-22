// translate.js
import { t } from "./i18n.js";

export function translateDom(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.innerHTML = t(key);          // <br> ありなので innerHTML
  });
}
