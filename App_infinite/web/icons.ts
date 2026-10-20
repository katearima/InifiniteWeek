import { defineComponent, h } from "vue/dist/vue.esm-browser.prod.js";
const paths: Record<string, string> = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  comment: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 1 1 17 0Z",
  compass: "m16.2 7.8-2.4 6-6 2.4 2.4-6 6-2.4ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75",
  bookmark: "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  plus: "M12 5v14M5 12h14", close: "m6 6 12 12M6 18 18 6", search: "m21 21-4.35-4.35M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z",
  clock: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-8-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  arrow: "m9 5 7 7-7 7", back: "m15 5-7 7 7 7", check: "m5 12 4 4L19 6",
  refresh: "M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.55-1.4L20 8M4 16l2.35 2.4A7 7 0 0 0 17.9 17",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9",
  edit: "m16 3 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-5L4 15v5Z", lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z",
};
export const Icon = defineComponent({
  props: { name: { type: String, required: true } },
  setup: props => () => h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [h("path", { d: paths[props.name] ?? paths.calendar })]),
});
