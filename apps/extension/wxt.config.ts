import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "StudentHub | استخراج دروس",
    description:
      "استخراج لیست دروس ارائه‌شده از سامانه آموزشیار و ساخت خروجی JSON آماده برای رجیستری StudentHub",

    // Programmatic injection only (activeTab) - no persistent content script,
    // no host permissions. The extension does nothing until the user clicks.
    permissions: ["activeTab", "scripting", "storage"],

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
