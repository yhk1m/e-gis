# eGIS 개발용 MCP 설정 가이드

## MCP란?

MCP(Model Context Protocol)는 Claude Desktop에서 외부 도구와 서비스에 접근할 수 있게 해주는 프로토콜입니다. eGIS 개발 시 Claude가 직접 코드를 수정하고, 데이터베이스를 조회하고, GitHub에 커밋할 수 있습니다.

---

## 설치 방법

### 1. Claude Desktop 설치

Claude Desktop이 설치되어 있어야 합니다.

### 2. 설정 파일 위치

운영체제별 설정 파일 위치:

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### 3. 설정 파일 복사

`claude_desktop_config.json` 파일을 위 경로에 복사합니다.

### 4. 토큰/키 설정

파일 내 다음 항목들을 실제 값으로 변경합니다:

```
/path/to/your/eGIS/project    → 실제 프로젝트 경로
your_github_token_here        → GitHub Personal Access Token
your-project-id               → Supabase 프로젝트 ID
your_supabase_service_role_key_here → Supabase Service Role Key
password                      → Supabase DB 비밀번호
```

### 5. Claude Desktop 재시작

설정 적용을 위해 Claude Desktop을 재시작합니다.

---

## MCP 서버 설명

### filesystem

```json
"filesystem": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/eGIS"]
}
```

**용도**: 프로젝트 폴더 내 파일 읽기/쓰기

**사용 예시**:
- "src/components/Map.js 파일 수정해줘"
- "새로운 컴포넌트 파일 만들어줘"

---

### github

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token"
  }
}
```

**용도**: GitHub 저장소 관리

**사용 예시**:
- "이 변경사항 커밋해줘"
- "새 브랜치 만들어줘"
- "이슈 목록 보여줘"

**토큰 발급 방법**:
1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token (classic)" 클릭
3. 권한 선택: `repo`, `workflow`
4. 토큰 복사 후 설정 파일에 붙여넣기

---

### supabase

```json
"supabase": {
  "command": "npx",
  "args": [
    "-y",
    "@supabase/mcp-server-supabase@latest",
    "--supabase-url", "https://xxx.supabase.co",
    "--supabase-key", "your_service_role_key"
  ]
}
```

**용도**: Supabase 프로젝트 관리

**사용 예시**:
- "users 테이블 생성해줘"
- "PostGIS 확장 활성화해줘"
- "RLS 정책 설정해줘"

**키 확인 방법**:
1. Supabase Dashboard → Project Settings → API
2. `service_role` 키 복사 (⚠️ 비밀 유지!)

---

### postgres

```json
"postgres": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-postgres",
    "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
  ]
}
```

**용도**: PostgreSQL/PostGIS 직접 쿼리

**사용 예시**:
- "PostGIS로 반경 5km 내 데이터 조회해줘"
- "공간 인덱스 생성해줘"
- "테이블 구조 확인해줘"

**연결 정보 확인**:
1. Supabase Dashboard → Project Settings → Database
2. Connection string 복사

---

### memory

```json
"memory": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"]
}
```

**용도**: 프로젝트 관련 컨텍스트 기억

**사용 예시**:
- 프로젝트 구조, 결정사항, TODO 등을 기억
- 다음 대화에서도 맥락 유지

---

### fetch

```json
"fetch": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"]
}
```

**용도**: 웹 리소스 가져오기

**사용 예시**:
- "OpenLayers 공식 문서에서 GeoTIFF 예제 찾아줘"
- "Turf.js buffer 함수 사용법 확인해줘"

---

### sequential-thinking

```json
"sequential-thinking": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}
```

**용도**: 복잡한 문제를 단계별로 사고

**사용 예시**:
- 아키텍처 설계
- 버그 디버깅
- 복잡한 기능 구현 계획

---

## 추가 가능한 MCP 서버

필요에 따라 추가할 수 있는 서버들:

| 서버 | 용도 |
|------|------|
| `@anthropics/mcp-server-puppeteer` | 브라우저 자동화, E2E 테스트 |
| `@anthropics/mcp-server-brave-search` | 웹 검색 |
| `@anthropics/mcp-server-slack` | Slack 알림 연동 |
| `@anthropics/mcp-server-google-drive` | 문서 관리 |

---

## 문제 해결

### MCP 서버가 연결되지 않을 때

1. Node.js가 설치되어 있는지 확인 (`node -v`)
2. npx가 작동하는지 확인 (`npx -v`)
3. Claude Desktop 로그 확인
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### 권한 오류

- GitHub: 토큰 권한 확인
- Supabase: service_role 키 사용 중인지 확인
- Filesystem: 프로젝트 폴더 경로 확인

---

## 보안 주의사항

⚠️ **중요**: 설정 파일에 민감한 정보가 포함되어 있습니다.

- `claude_desktop_config.json`을 Git에 커밋하지 마세요
- `.gitignore`에 추가하세요
- 토큰과 키는 환경 변수로 관리하는 것을 권장합니다

```gitignore
# .gitignore
claude_desktop_config.json
.env
```

---

## 참고 링크

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [MCP 서버 목록](https://github.com/modelcontextprotocol/servers)
- [Supabase MCP 서버](https://github.com/supabase/mcp-server-supabase)

