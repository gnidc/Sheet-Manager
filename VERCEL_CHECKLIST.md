# Vercel 배포 체크리스트

## 빌드 전 확인사항

### 1. 환경 변수 설정 확인
Vercel 대시보드 → Settings → Environment Variables에서 다음 변수가 설정되어 있는지 확인:

- [ ] `DATABASE_URL` - Supabase 연결 문자열
- [ ] `SESSION_SECRET` - 세션 암호화 시크릿
- [ ] `ADMIN_USERNAME` - admin 사용자명 (lifefit)
- [ ] `ADMIN_PASSWORD_HASH` - bcrypt 해시된 비밀번호
- [ ] `NODE_ENV` - production

### 2. 빌드 설정 확인
Vercel 대시보드 → Settings → General에서:

- [ ] Framework Preset: Other
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist/public`
- [ ] Install Command: `npm install`
- [ ] Root Directory: (비어있음)

### 3. 함수 설정 확인
`vercel.json`에서:
- [ ] `api/index.ts`가 서버리스 함수로 설정됨
- [ ] Runtime: `@vercel/node`

## 빌드 로그 확인

### 성공적인 빌드 로그 예시:
```
✓ building client...
✓ built in X.XXs
✓ building server...
⚡ Done in XXms
```

### 실패 시 확인할 사항:
1. **"tsx: command not found"**
   - 해결: `tsx`가 dependencies에 있는지 확인
   - 현재 상태: ✅ dependencies에 있음

2. **"Cannot find module"**
   - 해결: 모든 의존성이 package.json에 있는지 확인

3. **빌드는 성공했지만 런타임 에러**
   - Runtime Logs 확인
   - 환경 변수 확인

## 배포 후 확인사항

### 1. API 엔드포인트 테스트
브라우저에서 다음 URL 테스트:
- `https://your-domain.vercel.app/api/etfs` - JSON 응답 확인
- `https://your-domain.vercel.app/api/auth/me` - JSON 응답 확인

### 2. 프론트엔드 확인
- `https://your-domain.vercel.app/` - 페이지 로드 확인
- 개발자 도구 → Network 탭에서 API 요청 확인

### 3. 에러 발생 시
- Vercel 대시보드 → Runtime Logs 확인
- 브라우저 콘솔에서 에러 메시지 확인

## 문제 해결 단계

1. **빌드 실패**
   - Build Logs에서 에러 메시지 확인
   - 로컬에서 `npm run build` 실행하여 재현 확인

2. **API가 HTML 반환**
   - `vercel.json`의 rewrites 설정 확인
   - `api/index.ts`가 올바르게 설정되었는지 확인

3. **환경 변수 오류**
   - 모든 필수 환경 변수가 설정되었는지 확인
   - 환경 변수 이름과 값이 올바른지 확인

