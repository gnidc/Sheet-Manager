import { Smartphone } from "lucide-react";
import { AiMobileContent } from "@/pages/AiMobile";

export default function MobilePreview() {
  return (
    <div className="flex flex-col items-center">
      {/* 안내 헤더 */}
      <div className="w-full max-w-md mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="w-4 h-4 text-red-500" />
        <span className="font-medium">Mobile Preview</span>
        <span className="text-[10px]">— 모바일 페이지와 동일한 화면입니다</span>
      </div>

      {/* 모바일 프레임 */}
      <div className="w-full max-w-md border-2 border-gray-300 dark:border-gray-700 rounded-3xl overflow-hidden shadow-2xl bg-background" style={{ height: "75vh" }}>
        {/* 상단 노치 바 */}
        <div className="h-6 bg-gray-900 dark:bg-black flex items-center justify-center">
          <div className="w-20 h-3 bg-gray-800 dark:bg-gray-900 rounded-full" />
        </div>

        {/* 콘텐츠 영역 - AiMobileContent를 직접 렌더링 */}
        <div className="overflow-hidden" style={{ height: "calc(75vh - 24px)" }}>
          <div className="h-full [&>div]:!h-full [&>div]:!min-h-0">
            <AiMobileContent />
          </div>
        </div>
      </div>
    </div>
  );
}
