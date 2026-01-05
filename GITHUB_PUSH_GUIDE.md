# GitHub Push 가이드

## 현재 상태
- 커밋 완료: ✅
- 원격 저장소: `https://github.com/gnidc/Sheet-Manager`

## Push 방법

### 방법 1: Personal Access Token 사용 (권장)

1. **GitHub Personal Access Token 생성**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - "Generate new token (classic)" 클릭
   - Note: `Sheet-Manager Push`
   - Expiration: 원하는 기간 선택
   - Scopes: `repo` 체크
   - "Generate token" 클릭
   - **토큰을 복사해 안전한 곳에 저장** (다시 볼 수 없음)

2. **Push 실행**
```bash
git push origin main
```

프롬프트가 나타나면:
- Username: `gnidc` (또는 GitHub 사용자명)
- Password: **Personal Access Token** (일반 비밀번호가 아님!)

### 방법 2: GitHub CLI 사용

1. **GitHub CLI 설치**
```bash
brew install gh
```

2. **로그인**
```bash
gh auth login
```

3. **Push**
```bash
git push origin main
```

### 방법 3: SSH 키 설정 (장기적 해결책)

1. **SSH 키 생성** (이미 있다면 생략)
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

2. **SSH 키를 GitHub에 추가**
```bash
cat ~/.ssh/id_ed25519.pub
```
출력된 공개 키를 복사하여:
- GitHub → Settings → SSH and GPG keys → New SSH key
- Title: `MacBook Pro` (또는 원하는 이름)
- Key: 복사한 공개 키 붙여넣기
- Add SSH key

3. **원격 저장소를 SSH로 변경**
```bash
git remote set-url origin git@github.com:gnidc/Sheet-Manager.git
```

4. **Push**
```bash
git push origin main
```

## 현재 커밋 상태 확인

```bash
git log --oneline -5
```

## 문제 해결

### "fatal: could not read Username"
→ Personal Access Token 사용 필요

### "Host key verification failed"
→ SSH 키가 GitHub에 등록되지 않음

### "Permission denied"
→ 저장소 접근 권한 확인 필요

