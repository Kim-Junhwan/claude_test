# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

UIGen은 AI 기반 React 컴포넌트 생성기로, 실시간 미리보기를 제공한다. 사용자가 채팅으로 컴포넌트를 설명하면 AI(Anthropic Claude)가 React 코드를 생성하고, 샌드박스 iframe에서 렌더링한다. API 키 없이도 mock provider로 정적 컴포넌트를 반환하며 동작한다.

## 명령어

- `npm run setup` - 의존성 설치, Prisma 클라이언트 생성, 마이그레이션 실행 (초기 설정)
- `npm run dev` - Turbopack 개발 서버 시작 (`--require ./node-compat.cjs` 사용)
- `npm run build` - 프로덕션 빌드
- `npm run lint` - ESLint
- `npm test` - 전체 테스트 실행 (Vitest + jsdom)
- `npx vitest run src/path/to/test.ts` - 단일 테스트 파일 실행
- `npx vitest run -t "test name"` - 이름 패턴으로 테스트 실행
- `npm run db:reset` - SQLite 데이터베이스 초기화

## 아키텍처

### 핵심 데이터 흐름

1. 사용자가 **ChatInterface** -> **ChatContext** (`@ai-sdk/react`의 `useChat`)를 통해 메시지 전송
2. **`/api/chat/route.ts`**로 메시지 + 직렬화된 가상 파일 시스템 전달
3. 서버: AI 모델이 두 개의 도구(`str_replace_editor`, `file_manager`)로 `VirtualFileSystem` 인스턴스의 파일을 생성/수정/삭제
4. 도구 호출 결과가 클라이언트로 스트리밍되고, **FileSystemContext**가 클라이언트 측 `VirtualFileSystem`에 동일한 작업을 반영
5. **PreviewFrame**이 파일 시스템 변경을 감지하고, `@babel/standalone`으로 JSX를 변환한 뒤, blob URL로 import map을 생성하여 샌드박스 iframe에서 렌더링

### 핵심 추상화

- **`VirtualFileSystem`** (`src/lib/file-system.ts`): 트리 구조의 인메모리 파일 시스템. 디스크에 파일을 쓰지 않는다. 직렬화/역직렬화를 지원하여 영속화 및 클라이언트-서버 간 전송에 사용.
- **AI 도구** (`src/lib/tools/`): AI 모델에 노출되는 두 개의 도구:
  - `str_replace_editor`: 파일 생성, 문자열 교체, 줄 삽입 (Anthropic의 텍스트 에디터 도구 모델)
  - `file_manager`: 파일/디렉토리 이름 변경 및 삭제
- **JSX Transformer** (`src/lib/transform/jsx-transformer.ts`): 클라이언트 측 Babel 변환으로 import map을 구성. 서드파티 패키지는 `esm.sh`로 해석, 로컬 파일은 blob URL로 변환. 누락된 import는 플레이스홀더 모듈 생성.
- **Mock Provider** (`src/lib/provider.ts`): `ANTHROPIC_API_KEY`가 없으면 `MockLanguageModel`이 도구 호출을 시뮬레이션. API 키가 있으면 `claude-haiku-4-5` 사용.

### 라우팅 & 인증

- **`/`** - 비로그인 사용자는 익명 플레이그라운드, 로그인 사용자는 최근 프로젝트로 리다이렉트
- **`/[projectId]`** - 프로젝트 페이지 (인증 필요)
- **인증**: JWT 세션을 httpOnly 쿠키에 저장 (`jose` 라이브러리). `src/actions/index.ts`의 서버 액션이 signUp/signIn/signOut 처리. 미들웨어가 `/api/projects`, `/api/filesystem` 라우트 보호.
- **Prisma + SQLite**: User, Project 모델. Project는 메시지와 파일 시스템 데이터를 JSON 문자열로 저장. 데이터베이스 스키마는 `prisma/schema.prisma`에 정의되어 있으므로, 저장된 데이터 구조를 이해해야 할 때 참조할 것.

### UI 구조

`MainContent`가 메인 레이아웃: 리사이즈 가능한 좌측 패널(채팅) + 우측 패널(미리보기/코드 전환). 코드 뷰는 FileTree와 CodeEditor(Monaco)로 구성된 중첩 리사이즈 분할.

## 기술 스택 참고

- **Next.js 15** App Router, React 19, Tailwind CSS v4
- **shadcn/ui** (new-york 스타일) UI 프리미티브 - `src/components/ui/`
- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) 스트리밍 채팅 및 도구 호출
- **Prisma** 클라이언트 생성 경로: `src/generated/prisma` (기본 위치가 아님)
- 경로 별칭: `@/*` -> `./src/*`

## 코드 스타일

- 주석은 복잡한 로직에만 작성. 자명한 코드에는 주석을 달지 않는다.
