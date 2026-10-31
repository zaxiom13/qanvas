import "./app.css";
import { mount } from "svelte";
import App from "./app/App.svelte";

mount(App, { target: document.getElementById("app")! });
