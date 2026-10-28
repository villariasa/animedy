import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { registerServiceWorker } from "$lib/pwa/register";

registerServiceWorker();

const target = document.getElementById("app");
if (target === null) {
  throw new Error("Missing #app mount element");
}

export default mount(App, { target });
