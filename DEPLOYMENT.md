# 배포 가이드

## GitHub Push

현재 커밋은 완료되었습니다. GitHub에 push하려면:

```bash
git push origin main
```

인증이 필요한 경우:
- Personal Access Token 사용
- 또는 SSH 키 설정

## Vercel 배포

### 방법 1: Vercel CLI 사용

1. **Vercel CLI 설치**
```bash
npm i -g vercel
```

2. **Vercel 로그인**
```bash
vercel login
```

3. **프로젝트 배포**
```bash
vercel
```

4. **프로덕션 배포**
```bash
vercel --prod
```

### 방법 2: Vercel 웹 대시보드 사용

1. **Vercel 대시보드 접속**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **프로젝트 Import**
   - "Add New..." → "Project" 클릭
   - GitHub 저장소 선택: `gnidc/Sheet-Manager`
   - Import 클릭

3. **환경 변수 설정**
   Vercel 대시보드에서 다음 환경 변수를 설정하세요:

   ```
   DATABASE_URL=postgresql://postgres.ookhcpbxsdsyypcvdxvm:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres
   SESSION_SECRET=[생성한 세션 시크릿]
   ADMIN_USERNAME=lifefit
   ADMIN_PASSWORD_HASH=[bcrypt 해시]
   NODE_ENV=production
   PORT=3000
   ```

4. **빌드 설정 확인**
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`

5. **배포**
   - "Deploy" 버튼 클릭

### 환경 변수 생성 방법

#### SESSION_SECRET 생성
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### ADMIN_PASSWORD_HASH 생성
```bash
node scripts/set-admin-password.js "your-password"
```
생성된 해시를 `.env` 파일에서 복사하거나, 스크립트 출력에서 확인하세요.

### Vercel 배포 후 확인사항

1. **환경 변수 확인**
   - Vercel 대시보드 → Settings → Environment Variables
   - 모든 환경 변수가 설정되었는지 확인

2. **빌드 로그 확인**
   - Deployments 탭에서 빌드 로그 확인
   - 오류가 있으면 수정 후 재배포

3. **도메인 확인**
   - Vercel이 자동으로 생성한 도메인으로 접속
   - 또는 커스텀 도메인 설정

## 문제 해결

### 빌드 실패 시

1. **로컬에서 빌드 테스트**
```bash
npm run build
```

2. **환경 변수 확인**
   - Vercel 대시보드에서 모든 환경 변수가 설정되었는지 확인

3. **로그 확인**
   - Vercel 배포 로그에서 오류 메시지 확인

### 데이터베이스 연결 오류

- `DATABASE_URL`이 올바른지 확인
- Supabase Connection Pooling 사용 권장
- SSL 모드 필요 시 `?sslmode=require` 추가

### 세션 오류

- `SESSION_SECRET`이 설정되었는지 확인
- 프로덕션과 개발 환경에서 다른 값 사용 권장

