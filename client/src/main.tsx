import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Google OAuth 팝업 콜백 처리
// Google OAuth 리다이렉트 후 hash에 access_token이 포함됨
// window.opener는 Google의 COOP 헤더로 인해 null이 될 수 있으므로
// localStorage를 통해 부모 창에 토큰을 전달 (storage 이벤트는 다른 창에서 감지됨)
if (window.location.hash.includes("access_token")) {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = params.get("access_token");
  if (accessToken) {
    // localStorage에 토큰 저장 → 부모 창에서 storage 이벤트로 감지
    localStorage.setItem("google-oauth-token", accessToken);
    
    // window.opener가 살아있으면 postMessage도 시도 (백업)
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: "google-oauth-callback", accessToken },
          window.location.origin
        );
      }
    } catch {
      // cross-origin 에러 무시
    }
    
    // 팝업 닫기
    window.close();
    
    // window.close()가 실패할 수 있으므로 (일부 브라우저)
    // SPA를 렌더링하지 않고 안내 메시지 표시
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>로그인 처리 중... 이 창을 닫아주세요.</p></div>';
    }
  }
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
