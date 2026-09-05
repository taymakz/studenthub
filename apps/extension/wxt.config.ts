import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  zip: {
    // Single release artifact per build (deflate level 9 is the default).
    artifactTemplate: "extention-{{packageVersion}}.zip",
  },
  manifest: {
    name: "StudentHub | استخراج دروس",
    description:
      "استخراج لیست دروس ارائه‌شده از سامانه آموزشیار و ساخت خروجی JSON آماده برای رجیستری StudentHub",

    // Programmatic injection only (activeTab) - no persistent content script.
    // Host permissions are required to access nested iframe documents across
    // university subdomains and internal framesets (e.g. Golestan).
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["<all_urls>"],

    icons: {
      "16": "/icons/icon-16.png",
      "32": "/icons/icon-32.png",
      "48": "/icons/icon-48.png",
      "128": "/icons/icon-128.png",
    },
    action: {
      default_title: "StudentHub Scraper",
      default_icon: {
        "16": "/icons/icon-16.png",
        "32": "/icons/icon-32.png",
        "48": "/icons/icon-48.png",
        "128": "/icons/icon-128.png",
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
