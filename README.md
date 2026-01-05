# Sheet Manager

한국 ETF(상장지수펀드) 정보 대시보드 애플리케이션입니다. 특히 커버드콜 ETF 및 기타 투자 상품에 중점을 둡니다.

## 프로젝트 개요

이 애플리케이션은 사용자가 ETF 항목을 탐색, 검색, 필터링, 생성, 업데이트 및 삭제할 수 있도록 합니다. 수수료, 수익률, 시가총액, 배당 주기, 기초 자산 등 금융 데이터를 표시합니다.

## 기술 스택

### 프론트엔드
- **React 18** with TypeScript
- **Wouter** - 경량 클라이언트 사이드 라우터
- **TanStack React Query** - 서버 상태 관리
- **shadcn/ui** - UI 컴포넌트 라이브러리 (Radix UI 기반)
- **Tailwind CSS** - 스타일링 (라이트/다크 모드 지원)
- **Vite** - 빌드 도구

### 백엔드
- **Node.js** with **Express.js**
- **TypeScript** with ESM 모듈
- **Drizzle ORM** - 타입 안전 데이터베이스 쿼리
- **Zod** - 런타임 스키마 검증

### 데이터베이스
- **PostgreSQL**

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

`.env` 파일을 열어 다음 변수들을 설정하세요:

- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 URL
- `SESSION_SECRET`: 세션 암호화를 위한 시크릿 키
- `PORT`: 서버 포트 (기본값: 5000)
- `NODE_ENV`: `development` 또는 `production`
- `FINNHUB_API_KEY`: (선택사항) Finnhub API 키

### 3. 데이터베이스 설정

PostgreSQL 데이터베이스를 생성하고 연결 URL을 `.env` 파일에 설정하세요.

데이터베이스 스키마를 푸시하려면:

```bash
npm run db:push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

서버는 기본적으로 `http://localhost:5000`에서 실행됩니다.

## 스크립트

- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm start` - 프로덕션 서버 실행
- `npm run check` - TypeScript 타입 체크
- `npm run db:push` - 데이터베이스 스키마 푸시

## 프로젝트 구조

```
Sheet-Manager/
├── client/              # 프론트엔드 코드
│   ├── src/
│   │   ├── components/  # React 컴포넌트
│   │   ├── hooks/       # 커스텀 훅
│   │   ├── pages/       # 페이지 컴포넌트
│   │   └── lib/         # 유틸리티
│   └── index.html
├── server/              # 백엔드 코드
│   ├── index.ts         # Express 앱 설정
│   ├── routes.ts        # API 엔드포인트
│   ├── storage.ts       # 데이터베이스 접근 레이어
│   └── db.ts            # 데이터베이스 연결
├── shared/              # 공유 코드
│   ├── schema.ts        # 데이터베이스 스키마 및 Zod 검증
│   └── routes.ts        # API 라우트 정의
└── scripts/             # 유틸리티 스크립트
```

## 데이터 동기화

개발 및 프로덕션 데이터베이스 간 데이터를 동기화하려면:

### 데이터 내보내기
```
GET /api/export
```

### 데이터 가져오기
```
POST /api/import
Content-Type: application/json

{ "data": [...] }
```

## 라이센스

MIT

