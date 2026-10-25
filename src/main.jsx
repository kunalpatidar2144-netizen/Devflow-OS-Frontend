
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import "./index.css";
import App from "./App.jsx";

// Apply the saved theme before React paints to reduce light-theme flashes on refresh.
try {
  const settings = JSON.parse(localStorage.getItem("devflowSettings") || "{}");
  const theme = settings?.appearance?.theme || "light";
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("app-dark", Boolean(dark));
} catch {
  document.documentElement.classList.remove("app-dark");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        richColors
        expand={true}
        closeButton
      />

      <App />
    </BrowserRouter>
  </StrictMode>
);