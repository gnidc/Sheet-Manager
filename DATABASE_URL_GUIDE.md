# Supabase DATABASE_URL 설정 가이드

## Project Reference
- Project ID: `ookhcpbxsdsyypcvdxvm`
- Project URL: `https://ookhcpbxsdsyypcvdxvm.supabase.co`

## DATABASE_URL 형식

### 방법 1: Connection Pooling (권장) ⭐
```
postgresql://postgres.ookhcpbxsdsyypcvdxvm:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres
```

**예시:**
```
postgresql://postgres.ookhcpbxsdsyypcvdxvm:mypassword123@aws-0-us-east-1.pooler.supabase.co:6543/postgres
```

### 방법 2: Direct Connection
```
postgresql://postgres:[YOUR-PASSWORD]@db.ookhcpbxsdsyypcvdxvm.supabase.co:5432/postgres
```

**예시:**
```
postgresql://postgres:mypassword123@db.ookhcpbxsdsyypcvdxvm.supabase.co:5432/postgres
```

## Supabase 대시보드에서 확인하는 방법

1. **Supabase 대시보드 접속**
2. **Settings** → **Database** 클릭
3. **Connection string** 섹션에서:
   - **Connection Pooling** 탭 선택 (권장)
   - 또는 **Direct connection** 탭 선택
4. **URI** 형식의 연결 문자열 복사
5. `.env` 파일의 `DATABASE_URL`에 붙여넣기

## .env 파일 예시

```bash
# Connection Pooling 사용 (권장)
DATABASE_URL=postgresql://postgres.ookhcpbxsdsyypcvdxvm:your-password@aws-0-us-east-1.pooler.supabase.co:6543/postgres

# Session Secret
SESSION_SECRET=your-session-secret-here

# Server Port
PORT=5000

# Node Environment
NODE_ENV=development
```

## 필요한 정보

- **[YOUR-PASSWORD]**: Supabase 프로젝트 생성 시 설정한 데이터베이스 비밀번호
- **[REGION]**: 프로젝트 지역 코드 (예: `us-east-1`, `ap-northeast-2`, `eu-west-1` 등)

## 비밀번호 확인/재설정

비밀번호를 모르는 경우:
1. Supabase 대시보드 → **Settings** → **Database**
2. **Database password** 섹션에서 **Reset database password** 클릭
3. 새 비밀번호 설정

## SSL 연결 (필요한 경우)

일부 환경에서는 SSL이 필요할 수 있습니다:
```
postgresql://postgres.ookhcpbxsdsyypcvdxvm:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres?sslmode=require
```

