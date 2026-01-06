# Vercel에서 데이터베이스 연결 설정 가이드

## 문제: 로컬에서는 작동하지만 Vercel에서만 DB를 읽지 못함

이 문제는 주로 다음 원인으로 발생합니다:
1. Vercel 환경 변수가 설정되지 않음
2. 잘못된 DATABASE_URL 형식 (Connection Pooling 미사용)
3. Serverless 환경에 맞지 않은 Pool 설정

## 해결 방법

### 1. Vercel 환경 변수 확인 및 설정

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택

2. **Settings → Environment Variables** 이동

3. **DATABASE_URL 확인**
   - `DATABASE_URL`이 있는지 확인
   - 값이 비어있지 않은지 확인

### 2. Supabase Connection Pooling URL 사용 (필수!)

Vercel의 serverless 환경에서는 **반드시 Connection Pooling URL을 사용**해야 합니다.

#### ❌ 잘못된 형식 (Direct Connection)
```
postgresql://postgres:[PASSWORD]@db.ookhcpbxsdsyypcvdxvm.supabase.co:5432/postgres
```
이 형식은 serverless 환경에서 연결 제한 문제를 일으킬 수 있습니다.

#### ✅ 올바른 형식 (Connection Pooling)
```
postgresql://postgres.ookhcpbxsdsyypcvdxvm:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres
```

### 3. Supabase에서 Connection Pooling URL 가져오기

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **Settings → Database** 클릭

3. **Connection string** 섹션에서:
   - **Connection Pooling** 탭 선택
   - **Session mode** 선택 (권장)
   - **URI** 형식의 연결 문자열 복사
   - 형식: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres`

4. **Vercel에 환경 변수로 설정**
   - Vercel 대시보드 → Settings → Environment Variables
   - `DATABASE_URL` 추가 또는 수정
   - 위에서 복사한 Connection Pooling URL 붙여넣기
   - **Environment**: Production, Preview, Development 모두 선택

### 4. 환경 변수 설정 후 재배포

환경 변수를 설정하거나 수정한 후:
1. **Redeploy** 클릭 (Vercel 대시보드에서)
2. 또는 새로운 커밋을 push하여 자동 재배포

### 5. 확인 방법

배포 후 Vercel Functions 로그에서 다음을 확인:
- `=== DATABASE_URL Debug ===` 로그
- `DATABASE_URL exists: true`
- `DATABASE_URL value: [숫자] chars`
- `Database pool created (max: 1, Vercel: true)`

## 현재 적용된 최적화

코드에서 자동으로 적용되는 설정:
- **Vercel 환경 감지**: `process.env.VERCEL` 확인
- **연결 수 제한**: Vercel에서는 `max: 1` (serverless 제약)
- **타임아웃 단축**: `idleTimeoutMillis: 10000` (10초)
- **SSL 설정**: 자동으로 SSL 활성화
- **에러 핸들링**: Pool 에러 로깅

## 문제 해결 체크리스트

- [ ] Vercel 환경 변수에 `DATABASE_URL`이 설정되어 있음
- [ ] `DATABASE_URL`이 Connection Pooling URL 형식임 (포트 6543)
- [ ] 환경 변수가 Production, Preview, Development 모두에 설정됨
- [ ] 환경 변수 설정 후 재배포 완료
- [ ] Vercel Functions 로그에서 `DATABASE_URL Debug` 로그 확인
- [ ] Supabase 대시보드에서 데이터가 실제로 존재함

## 추가 디버깅

Vercel Functions 로그에서 다음 명령어로 확인:
```bash
# Vercel CLI 사용 (설치 필요: npm i -g vercel)
vercel logs [프로젝트명] --follow
```

또는 Vercel 대시보드 → 프로젝트 → Functions 탭에서 실시간 로그 확인

