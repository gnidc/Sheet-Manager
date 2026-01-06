# Vercel 배포 문제 해결 가이드

## 현재 설정 확인

### 빌드 명령어
- Build Command: `npm run build`
- Output Directory: `dist/public`
- Install Command: `npm install`

### 환경 변수 필수 항목
다음 환경 변수가 Vercel에 설정되어 있어야 합니다:

```
DATABASE_URL=postgresql://postgres.ookhcpbxsdsyypcvdxvm:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres
SESSION_SECRET=[생성한 시크릿]
ADMIN_USERNAME=lifefit
ADMIN_PASSWORD_HASH=[bcrypt 해시]
NODE_ENV=production
```

## 일반적인 문제 해결

### 1. 빌드 실패 (exit code 127)
**원인**: 명령어를 찾을 수 없음
**해결**: 
- `tsx`가 dependencies에 있는지 확인
- 빌드 스크립트가 올바른지 확인

### 2. API 요청이 HTML 반환
**원인**: 라우팅 설정 문제
**해결**: 
- `vercel.json`의 rewrites 설정 확인
- `api/index.ts`가 올바르게 설정되었는지 확인

### 3. 환경 변수 누락
**원인**: 필수 환경 변수가 설정되지 않음
**해결**: 
- Vercel 대시보드 → Settings → Environment Variables 확인
- 모든 필수 변수가 설정되었는지 확인

## 빌드 로그 확인 방법

1. Vercel 대시보드 → Deployments
2. 실패한 배포 클릭
3. Build Logs 섹션 확인
4. 에러 메시지 확인

## 로컬에서 빌드 테스트

```bash
# 의존성 설치
npm install

# 빌드 실행
npm run build

# 빌드 결과 확인
ls -la dist/public
ls -la dist/index.cjs
```

## Vercel 재배포

1. GitHub에 push
2. Vercel이 자동으로 재배포 시작
3. 또는 Vercel 대시보드에서 "Redeploy" 클릭

