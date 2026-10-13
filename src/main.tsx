import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./globals.css";
import Home from "./components/Home";
import Badges from "./pages/Badges";
import Cases from "./pages/Cases";
import Case from "./pages/Case";
import Methods from "./pages/Methods";
import Method from "./pages/Method";
import Unlocks from "./pages/Unlocks";
import Unlock from "./pages/Unlock";
import Bind from "./pages/Bind";
import ExampleApp from "./pages/ExampleApp";
import Me from "./pages/Me";
import Privacy from "./pages/Privacy";
import Verified from "./pages/Verified";
import NotFound from "./pages/NotFound";
import OpenCerts from "./pages/OpenCerts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:handle" element={<Case />} />
        <Route path="/methods" element={<Methods />} />
        <Route path="/methods/:namespace/:name" element={<Method />} />
        <Route path="/unlocks" element={<Unlocks />} />
        <Route path="/unlocks/:handle" element={<Unlock />} />
        <Route path="/bind" element={<Bind />} />
        <Route path="/me" element={<Me />} />
        <Route path="/example-app" element={<ExampleApp />} />
        <Route path="/opencerts/:namespace/:name" element={<OpenCerts />} />
        <Route path="/singpass/privacy" element={<Privacy />} />
        <Route path="/singpass/verified/:appId/:pairwise" element={<Verified />} />
        <Route path="/privacy" element={<Navigate to="/singpass/privacy" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
