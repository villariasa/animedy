import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { registerServiceWorker } from "$lib/pwa/register";
import { installInspectGuard } from "$lib/security/inspectGuard";

registerServiceWorker();

// Production only — never gets in the way of local dev/debugging.
if (import.meta.env.PROD) {
  installInspectGuard();
}

const target = document.getElementById("app");
if (target === null) {
  throw new Error("Missing #app mount element");
}

export default mount(App, { target });
