import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Google OAuth 팝업 콜백 처리
// 팝업에서 redirect 후 이 페이지가 로드될 때, hash에 access_token이 있으면
// 부모 창에 토큰을 전달하고 팝업을 닫음 (SPA 전체를 로드하지 않음)
if (window.opener && window.location.hash.includes("access_token")) {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = params.get("access_token");
  if (accessToken) {
    window.opener.postMessage(
      { type: "google-oauth-callback", accessToken },
      window.location.origin
    );
    window.close();
  }
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
