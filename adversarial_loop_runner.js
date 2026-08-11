const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    let payload = null;
    const headers = {};

    if (body && typeof body === 'object') {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

// 1회 완벽 검증 시나리오 (10단계 적대적 테스트)
async function runSinglePass(passNumber) {
  console.log(`\n--------------------------------------------------`);
  console.log(`🔥 [적대적 시나리오 회차 #${passNumber}] 10단계 검증 진행 중...`);
  console.log(`--------------------------------------------------`);

  // 1. PIN 3자리 거부 테스트
  const t1 = await makeRequest('POST', '/api/posts', {
    category: 'free', title: '공격테스트1', content: '내용', author: '해커', pinCode: '123'
  });
  if (t1.status !== 400 || t1.body.success !== false) {
    throw new Error(`[Step 1 Fail] 3자리 PIN이 거부되지 않고 통과됨 (Status: ${t1.status})`);
  }
  console.log(`  ✅ Step 1: 3자리 PIN 거부 확인 (400 Bad Request)`);

  // 2. PIN 영문 혼합 거부 테스트
  const t2 = await makeRequest('POST', '/api/posts', {
    category: 'free', title: '공격테스트2', content: '내용', author: '해커', pinCode: 'abcd'
  });
  if (t2.status !== 400 || t2.body.success !== false) {
    throw new Error(`[Step 2 Fail] 영문 PIN이 거부되지 않고 통과됨 (Status: ${t2.status})`);
  }
  console.log(`  ✅ Step 2: 영문/특수문자 PIN 거부 확인 (400 Bad Request)`);

  // 3. 정상 4자리 PIN 게시글 등록
  const t3 = await makeRequest('POST', '/api/posts', {
    category: 'free', title: `정상글_${passNumber}`, content: '# 마크다운 헤더 테스트\n**강조텍스트**', contentType: 'markdown', author: `작성자_${passNumber}`, pinCode: '5678'
  });
  if (t3.status !== 200 || !t3.body.success) {
    throw new Error(`[Step 3 Fail] 정상 게시글 등록 실패`);
  }
  const postId = t3.body.data.id;
  console.log(`  ✅ Step 3: 정상 게시글 생성 성공 (ID: ${postId})`);

  // 4. 틀린 PIN으로 삭제 시도 거부 테스트
  const t4 = await makeRequest('POST', `/api/posts/${postId}/delete`, { pinCode: '9999' });
  if (t4.status !== 401 || t4.body.success !== false) {
    throw new Error(`[Step 4 Fail] 틀린 PIN으로 삭제가 허용됨`);
  }
  console.log(`  ✅ Step 4: 틀린 PIN 삭제 거부 확인 (401 Unauthorized)`);

  // 5. 마크다운 게시글 단건 조회 검증
  const t5 = await makeRequest('GET', `/api/posts/${postId}`);
  if (t5.status !== 200 || t5.body.data.content_type !== 'markdown') {
    throw new Error(`[Step 5 Fail] 마크다운 게시글 조회 실패`);
  }
  console.log(`  ✅ Step 5: 마크다운 content_type 보존 조회 확인`);

  // 6. 댓글 작성 시 2자리 PIN 거부 테스트
  const t6 = await makeRequest('POST', `/api/posts/${postId}/comments`, { author: '댓글이', content: '테스트댓글', pinCode: '12' });
  if (t6.status !== 400) {
    throw new Error(`[Step 6 Fail] 댓글 2자리 PIN 거부 실패`);
  }
  console.log(`  ✅ Step 6: 댓글 2자리 PIN 거부 확인 (400 Bad Request)`);

  // 7. 댓글 정상 4자리 PIN 등록 테스트
  const t7 = await makeRequest('POST', `/api/posts/${postId}/comments`, { author: '댓글이', content: '테스트댓글', pinCode: '1234' });
  if (t7.status !== 200 || !t7.body.success) {
    throw new Error(`[Step 7 Fail] 댓글 정상 등록 실패`);
  }
  const commentId = t7.body.data.id;
  console.log(`  ✅ Step 7: 댓글 정상 등록 성공 (Comment ID: ${commentId})`);

  // 8. 작성자 기반 타겟 검색 테스트
  const t8 = await makeRequest('GET', `/api/posts?searchType=author&keyword=작성자_${passNumber}`);
  if (t8.status !== 200 || t8.body.data.posts.length === 0) {
    throw new Error(`[Step 8 Fail] 타겟 검색 수행 실패`);
  }
  console.log(`  ✅ Step 8: 작성자 타겟 검색 성공 (${t8.body.data.posts.length}건 검색됨)`);

  // 9. 댓글 정상 삭제 테스트
  const t9 = await makeRequest('POST', `/api/comments/${commentId}/delete`, { pinCode: '1234' });
  if (t9.status !== 200 || t9.body.success !== false && !t9.body.success) {
    throw new Error(`[Step 9 Fail] 댓글 삭제 실패`);
  }
  console.log(`  ✅ Step 9: 댓글 정상 PIN 삭제 성공`);

  // 10. 게시글 최종 올바른 PIN 삭제 테스트
  const t10 = await makeRequest('POST', `/api/posts/${postId}/delete`, { pinCode: '5678' });
  if (t10.status !== 200 || !t10.body.success) {
    throw new Error(`[Step 10 Fail] 게시글 최종 삭제 실패`);
  }
  console.log(`  ✅ Step 10: 게시글 정상 PIN 삭제 성공`);

  console.log(`✨ 회차 #${passNumber} 통과!`);
  return true;
}

// 10회 연속 적대적 검증 루프 엔진
async function startAdversarialLoop() {
  let consecutiveSuccessCount = 0;
  const TARGET_SUCCESS_COUNT = 10;
  let totalAttempts = 0;

  console.log(`=======================================================`);
  console.log(`🤖 [적대적 검증 멀티에이전트 시스템 가동]`);
  console.log(`🎯 목표: 연속 10회 검증 100% 무결점 통과`);
  console.log(`⚠️ 규칙: 실패 시 연속 성공 횟수 0회로 리셋 후 처음부터 재시작`);
  console.log(`=======================================================\n`);

  while (consecutiveSuccessCount < TARGET_SUCCESS_COUNT) {
    totalAttempts++;
    const currentPass = consecutiveSuccessCount + 1;
    try {
      await runSinglePass(currentPass);
      consecutiveSuccessCount++;
      console.log(`📈 [연속 성공 달성률] ➡️ ${consecutiveSuccessCount} / ${TARGET_SUCCESS_COUNT} 회`);
    } catch (err) {
      console.error(`\n❌ [검증 미통과 발생!] 원인: ${err.message}`);
      console.error(`💥 [규칙 적용] 연속 성공 횟수가 0회로 초기화되었습니다!\n`);
      consecutiveSuccessCount = 0;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`🏆 [검증판단 전문 에이전트 최종 판정] PASS`);
  console.log(`🎉 총 ${totalAttempts}회 시도 끝에 10회 연속 적대적 테스트 통과!`);
  console.log(`=======================================================\n`);
}

startAdversarialLoop();
