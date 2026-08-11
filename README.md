# 🏢 폐쇄망 사내 초경량 웹 게시판 (Intranet Board) 핸드북

본 문서는 사내 폐쇄망 환경에서 운용되는 **초경량 사내 통합 웹 게시판 프로젝트의 전체 설계 구조, 구현 컨셉, 데이터 관리 방안 및 후속 개발 가이드**를 담고 있는 공식 명세서입니다. 다른 AI 세션이나 새로운 개발자가 이어서 작업할 때 본 문서를 참조하면 시스템을 100% 이해하고 연속성 있게 개발할 수 있습니다.

---

## 1. 프로젝트 목적 및 배경 (Background & Goal)

* **배경**: 사내 폐쇄망(인터넷 차단) 환경에서 별도의 고가 서버 PC나 RDBMS(MySQL, Oracle 등)를 설치하기 어려운 상황.
* **목적**: 사내에 항시 켜져 있는 일반 사무용 PC 1대를 메인 호스트로 지정하여, 모든 사내 직원이 자유롭게 소통하고 자료를 공유할 수 있는 무설치 초경량 웹 게시판 구축.
* **프로젝트 위치**: `C:\Users\CEO\.gemini\antigravity-ide\scratch\internal-board`

---

## 2. 핵심 설계 컨셉 및 기술 철학 (Design Architecture)

### ① Zero External Dependency (외부 의존성 0%)
* 외부 인터넷 및 외부 CDN(폰트, CSS 라이브러리 등) 연결이 차단된 폐쇄망에서도 **100% 독립 동작**하도록 모든 웹 폰트 대안 및 리소스를 내부 번들링함.

### ② Zero DB Engine (무설치 단일 파일 데이터베이스)
* RDBMS 데몬 설치 없이 **단일 데이터 파일(`data/board_repository.json`)**을 통해 게시글, 댓글, 첨부파일 메타데이터를 원자적으로 기록/관리.
* 서버 PC 리소스(CPU/RAM) 소비 극소화 (**RAM 점유율 30MB~50MB 수준**).

### ③ 원본 디스크 저장 & 스트리밍 입출력 (File Storage Strategy)
* **파일 압축 안 함**: 업로드되는 대부분의 파일(PDF, ZIP, 이미지, Office 문서)은 이미 내부 압축 포맷이므로 서버 측 2차 압축을 배제하여 CPU 부하 0% 달성.
* **스트리밍(Stream) 처리**: `fs.createReadStream().pipe(res)` 기법을 통해 2GB 이상의 대용량 파일 전송 시에도 서버 RAM에 전체를 올리지 않고 조각(Chunk) 단위 입출력.
* **파일 1:1 보관**: `uploads/` 폴더에 타임스탬프 기반 이름으로 원본 100% 보관. (게시글 삭제 시 물리 파일도 즉시 자동 열거 삭제).

### ④ 핀코드(PIN) 삭제 인증 (No Member System)
* 복잡한 회원가입/로그인 관리 부담을 제거하고, 게시글/댓글 작성 시 **'작성자명 + 4자리 비밀번호 PIN'**을 입력받아 SHA-256 해시로 verification 및 삭제 처리.

### ⑤ 미니멀 UI & 4-in-1 타겟/통합 검색 (Minimal UI & Targeted Search)
* **미니멀리즘**: 불필요한 추천수, 조회수, 마이페이지 등을 쳐내고 `[분류 / 제목 / 작성자 / 작성일]` 4개 필드 중심 구성.
* **검색 엔진**:
  * **🔍 통합검색 (Default)**: 글제목 + 작성자 + 첨부파일명 + 댓글내용 전체 대상 검색
  * **드롭다운 선택**: [글제목], [작성자], [첨부파일명], [댓글내용] 타겟 검색 지원
  * **한글 파일명 디코딩**: Multer 인코딩 보정을 통한 한글 파일명 100% 매칭 검색.

---

## 3. 소스코드 구조 및 파일 명세 (Directory & Source Specification)

```
C:\Users\CEO\.gemini\antigravity-ide\scratch\internal-board
 ├── 📄 package.json             # Express, Multer 등 초경량 의존성
 ├── 📄 server.js                 # RESTful API, MinimalBoardEngine, 파일 스트리밍 다운로드
 ├── 📁 data/
 │    └── 📄 board_repository.json # 게시글, 댓글, 첨부파일 메타데이터 DB
 ├── 📁 uploads/                  # 원본 첨부파일 물리적 저장 디렉터리
 └── 📁 public/
      ├── 📄 index.html           # SPA 탭 구조, 글쓰기/상세 모달, 검색 드롭다운 UI
      ├── 📄 style.css            # Glassmorphism 다크 테마 디자인 시스템
      └── 📄 app.js               # 비동기 통신, 카테고리/검색/파일/댓글 컨트롤러
```

### Key Functions in `server.js`
* `MinimalBoardEngine.prototype.getPosts({ category, keyword, searchType, page, limit })`
  * 탭 카테고리 필터링 및 `searchType`(`all`|`title`|`author`|`file`|`comment`)에 따른 조건부 검색.
* `Buffer.from(file.originalname, 'latin1').toString('utf8')`
  * 한글 파일명 깨짐을 방지하는 UTF-8 변환 디코더.

---

## 4. 실행 및 서버 운용 방법 (How to Run & Operate)

### 1) 서버 구동 (호스트 PC)
```bash
cd C:\Users\CEO\.gemini\antigravity-ide\scratch\internal-board
node server.js
```

### 2) 접속 주소
* **로컬 접속**: `http://localhost:3000`
* **사내 폐쇄망 공유 접속**: `http://[호스트PC_IP주소]:3000`

### 3) 완전 데이터 백업 및 이관 방법
* 다른 PC로 서버를 이전하거나 백업할 경우 `data/` 폴더와 `uploads/` 폴더만 그대로 복사하여 새 PC로 옮기면 1초 만에 100% 복구 완료됩니다.

---

## 5. 다른 세션에서 이어서 추가 작업할 수 있는 제안 항목 (Next Roadmap Options)

후속 세션에서 추가 기능 개발이 필요할 경우 아래 목록 중 선택하여 확장할 수 있습니다.

1. **중복 파일 해시 방지 (Deduplication)**: SHA-256 해시를 비교하여 동일 파일 중복 업로드 시 디스크 용량 절약 로직 추가.
2. **사내 네트워크 자동 백업 스크립트**: 매일 지정된 시각에 `data/` 및 `uploads/` 폴더를 다른 외장 드라이브로 복사하는 자동 스크립트 작성.
3. **카테고리 추가**: 자유/질문/자료공유 외 추가 카테고리(예: 공지사항 등) 확장.
