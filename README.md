# 🏢 사내 경량 폐쇄망 통합 게시판 (Internal Board System)

서버급 PC나 DB(MySQL/Oracle 등) 구축 없이, **사내 일반 PC 1대만으로 1분 만에 구동 가능한 경량 폐쇄망 통합 웹 게시판**입니다.

* **GitHub Repository**: [https://github.com/Peace-Min/internal-board](https://github.com/Peace-Min/internal-board)
* **주요 특징**: Zero DB C++ 빌드 의존성 없음 (단일 JSON 엔진), 2GB 대용량 파일 다운로드 스트리밍 지원, GitHub 스타일 마크다운/일반 텍스트 선택 지원, 실시간 미리보기 탭, 4자리 숫자 PIN 보안, 10회 연속 적대적 루프 검증 통과.

---

## 🚀 1. 호스트 PC (게시판 서버 역할을 할 PC) 실행 방법

### 사전 준비사항
* **Node.js 설치**: [Node.js 공식 홈페이지](https://nodejs.org)에서 LTS 버전 설치 (Node.js 16+ 이상 권장)

### 실행 순서
1. **레포지토리 클론 (Git Clone)**
   ```bash
   git clone https://github.com/Peace-Min/internal-board.git
   cd internal-board
   ```

2. **패키지 설치**
   ```bash
   npm install
   ```

3. **게시판 서버 실행**
   ```bash
   node server.js
   ```
   * 실행 성공 시 터미널에 아래 메시지가 출력됩니다:
     `[Validated PIN Board Server Running] Port: 3000`

---

## 🌐 2. 동일 사내 폐쇄망 PC들에서 접속하는 방법

동일 사내 네트워크(Wi-Fi 또는 사내 LAN선)에 연결된 다른 사내 인원들은 아래 절차로 접속합니다.

### A. 호스트 PC의 IP 주소 확인하기 (호스트 PC에서 수행)
1. 호스트 PC의 터미널(Command Prompt 또는 PowerShell)을 열고 입력:
   ```cmd
   ipconfig
   ```
2. 출력 항목 중 **`IPv4 주소`** (예: `192.168.0.15` 또는 `10.10.x.x`)를 확인합니다.

### B. 사내 다른 PC에서 브라우저로 접속하기
다른 사내 인원들의 PC 브라우저(Chrome, Edge 등) 주소창에 아래 주소를 입력하여 접속합니다:
```text
http://<호스트PC-IPv4주소>:3000
```
> **예시**: `http://192.168.0.15:3000` 또는 `http://10.20.30.40:3000`

---

## 🔒 3. 사내 접속 불가 시 체크리스트 (Windows 방화벽 설정)

다른 PC에서 접속이 안 되거나 "연결을 수락하지 않았습니다" 에러가 날 경우 호스트 PC의 Windows 방화벽을 설정해야 합니다:

1. 호스트 PC에서 `Windows 방화벽` (또는 `고급 보안이 포함된 Windows Defender 방화벽`) 실행.
2. **`인바운드 규칙`** $\rightarrow$ **`새 규칙...`** 클릭.
3. **규칙 종류**: `포트(O)` 선택 후 다음.
4. **특정 로컬 포트**: `3000` 입력 후 다음.
5. **작업**: `연결 허용(A)` 선택 후 다음.
6. **프로필**: 도메인, 개인, 공용 모두 체크 후 다음.
7. **이름**: `사내 게시판 (Port 3000)` 입력 후 완료.

---

## 🔄 4. 24시간 백그라운드 구동 팁 (PM2 프로세스 매니저)

터미널 창을 닫아도 게시판이 꺼지지 않도록 사내 PC에서 24시간 백그라운드 구동하려면 `PM2`를 활용합니다:

```bash
# PM2 설치 (전역)
npm install -g pm2

# 게시판 백그라운드 실행
pm2 start server.js --name "internal-board"

# 상태 확인
pm2 status

# 서버 재부팅 시 자동 실행 설정
pm2 startup
pm2 save
```

---

## 🛠️ 주요 기능 요약
* **카테고리**: 전체보기, 자유게시판, 질문게시판, 자료공유
* **작성 모드**: `📄 일반 텍스트 (Plain)` vs `📝 마크다운 (Markdown)` + `👁️ 실시간 미리보기 (Preview) 탭`
* **검색 옵션**: 통합검색 (기본), 글제목, 작성자, 첨부파일명, 댓글내용 타겟 검색
* **보안/삭제**: 숫자 4자리 PIN 이중 유효성 검사
