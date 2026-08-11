document.addEventListener('DOMContentLoaded', () => {
  let state = {
    currentCategory: 'all',
    currentPage: 1,
    searchKeyword: '',
    searchType: 'all',
    selectedFiles: [],
    activePostId: null,
    currentEditorTab: 'write'
  };

  const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    currentCategoryName: document.getElementById('current-category-name'),
    totalCountBadge: document.getElementById('total-count-badge'),
    searchType: document.getElementById('search-type'),
    searchInput: document.getElementById('search-input'),
    btnSearch: document.getElementById('btn-search'),
    postsTbody: document.getElementById('posts-tbody'),
    paginationControls: document.getElementById('pagination-controls'),

    btnOpenCreate: document.getElementById('btn-open-create'),
    modalCreatePost: document.getElementById('modal-create-post'),
    btnCloseCreate: document.getElementById('btn-close-create'),
    btnCancelCreate: document.getElementById('btn-cancel-create'),
    createPostForm: document.getElementById('create-post-form'),
    postCategorySelect: document.getElementById('post-category'),
    postContentTypeSelect: document.getElementById('post-content-type'),
    postContentTextarea: document.getElementById('post-content'),
    
    // Editor Tabs & Preview
    tabEditorWrite: document.getElementById('tab-editor-write'),
    tabEditorPreview: document.getElementById('tab-editor-preview'),
    editorWriteBox: document.getElementById('editor-write-box'),
    editorPreviewBox: document.getElementById('editor-preview-box'),
    editorModeHint: document.getElementById('editor-mode-hint'),

    fileDropzone: document.getElementById('file-dropzone'),
    fileInput: document.getElementById('file-input'),
    filePreviewList: document.getElementById('file-preview-list'),

    modalViewPost: document.getElementById('modal-view-post'),
    btnCloseView: document.getElementById('btn-close-view'),
    viewCategoryBadge: document.getElementById('view-category-badge'),
    viewTitle: document.getElementById('view-title'),
    viewAuthor: document.getElementById('view-author'),
    viewDate: document.getElementById('view-date'),
    viewContentTypeBadge: document.getElementById('view-content-type-badge'),
    viewContent: document.getElementById('view-content'),
    viewAttachmentsSection: document.getElementById('view-attachments-section'),
    viewAttachmentCards: document.getElementById('view-attachment-cards'),
    btnDeletePost: document.getElementById('btn-delete-post'),

    commentCountBadge: document.getElementById('comment-count-badge'),
    commentAuthor: document.getElementById('comment-author'),
    commentPin: document.getElementById('comment-pin'),
    commentContent: document.getElementById('comment-content'),
    btnSubmitComment: document.getElementById('btn-submit-comment'),
    commentList: document.getElementById('comment-list')
  };

  const categoryMap = {
    all: { name: '전체보기', badgeClass: 'badge-count' },
    free: { name: '자유게시판', badgeClass: 'badge-free' },
    qna: { name: '질문게시판', badgeClass: 'badge-qna' },
    share: { name: '자료공유', badgeClass: 'badge-share' }
  };

  init();

  function init() {
    bindEvents();
    loadPosts();
  }

  function bindEvents() {
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-category');
        elements.navTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.currentCategory = cat;
        state.currentPage = 1;
        elements.currentCategoryName.textContent = categoryMap[cat].name;
        loadPosts();
      });
    });

    elements.btnSearch.addEventListener('click', executeSearch);
    elements.searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') executeSearch();
    });

    elements.searchType.addEventListener('change', () => {
      if (elements.searchInput.value.trim().length > 0) executeSearch();
    });

    elements.btnOpenCreate.addEventListener('click', () => {
      if (state.currentCategory !== 'all') {
        elements.postCategorySelect.value = state.currentCategory;
      }
      switchEditorTab('write');
      openModal(elements.modalCreatePost);
    });

    elements.btnCloseCreate.addEventListener('click', () => closeModal(elements.modalCreatePost));
    elements.btnCancelCreate.addEventListener('click', () => closeModal(elements.modalCreatePost));
    elements.btnCloseView.addEventListener('click', () => closeModal(elements.modalViewPost));

    // Editor Write vs Preview 탭 이벤트
    elements.tabEditorWrite.addEventListener('click', () => switchEditorTab('write'));
    elements.tabEditorPreview.addEventListener('click', () => switchEditorTab('preview'));

    // 작성 모드(드롭다운) 변경 시 즉시 미리보기 갱신!
    elements.postContentTypeSelect.addEventListener('change', (e) => {
      const isMd = e.target.value === 'markdown';
      elements.editorModeHint.textContent = isMd ? '📝 마크다운 서식 작성 중 (Preview 지원)' : '📄 일반 텍스트 작성 중';
      updatePreview(); // 즉시 미리보기 리렌더링
    });

    // 본문 내용 작성(input) 중에도 미리보기 실시간 자동 갱신!
    elements.postContentTextarea.addEventListener('input', () => {
      if (state.currentEditorTab === 'preview') {
        updatePreview();
      }
    });

    elements.fileDropzone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) addFiles(Array.from(e.target.files));
    });

    elements.fileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.add('dragover');
    });

    elements.fileDropzone.addEventListener('dragleave', () => {
      elements.fileDropzone.classList.remove('dragover');
    });

    elements.fileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
    });

    elements.createPostForm.addEventListener('submit', handleCreatePostSubmit);
    elements.btnDeletePost.addEventListener('click', handleDeletePost);
    elements.btnSubmitComment.addEventListener('click', handleCreateComment);
  }

  // Editor Write / Preview 탭 스위칭
  function switchEditorTab(tabName) {
    state.currentEditorTab = tabName;
    if (tabName === 'write') {
      elements.tabEditorWrite.classList.add('active');
      elements.tabEditorPreview.classList.remove('active');
      elements.editorWriteBox.style.display = 'block';
      elements.editorPreviewBox.style.display = 'none';
    } else {
      elements.tabEditorWrite.classList.remove('active');
      elements.tabEditorPreview.classList.add('active');
      elements.editorWriteBox.style.display = 'none';
      elements.editorPreviewBox.style.display = 'block';
      updatePreview();
    }
  }

  // 실시간 미리보기 렌더링 업데이트 함수 (독립 갱신 엔진)
  function updatePreview() {
    const text = elements.postContentTextarea.value.trim();
    const isMarkdownMode = elements.postContentTypeSelect.value === 'markdown';

    if (!text) {
      elements.editorPreviewBox.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">미리볼 내용이 없습니다. 먼저 작성 탭에서 내용을 입력하세요.</p>`;
      return;
    }

    if (isMarkdownMode) {
      elements.editorPreviewBox.className = 'preview-content-box markdown-body';
      elements.editorPreviewBox.innerHTML = parseMarkdown(text);
    } else {
      elements.editorPreviewBox.className = 'preview-content-box';
      elements.editorPreviewBox.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    }
  }

  function executeSearch() {
    state.searchKeyword = elements.searchInput.value.trim();
    state.searchType = elements.searchType.value;
    state.currentPage = 1;
    loadPosts();
  }

  async function loadPosts() {
    elements.postsTbody.innerHTML = `<tr><td colspan="4" class="loading-cell">게시글 로딩 중...</td></tr>`;

    try {
      const params = new URLSearchParams({
        category: state.currentCategory,
        keyword: state.searchKeyword,
        searchType: state.searchType,
        page: state.currentPage,
        limit: 15
      });

      const res = await fetch(`/api/posts?${params}`);
      const json = await res.json();

      if (json.success) {
        renderPostsTable(json.data.posts);
        renderPagination(json.data.totalPages, json.data.page);
        elements.totalCountBadge.textContent = `${json.data.totalCount}건`;
      } else {
        elements.postsTbody.innerHTML = `<tr><td colspan="4" class="empty-cell">불러오기 실패</td></tr>`;
      }
    } catch (err) {
      elements.postsTbody.innerHTML = `<tr><td colspan="4" class="empty-cell">서버 통신 에러</td></tr>`;
    }
  }

  function renderPostsTable(posts) {
    if (!posts || posts.length === 0) {
      elements.postsTbody.innerHTML = `<tr><td colspan="4" class="empty-cell">게시글이 없습니다.</td></tr>`;
      return;
    }

    elements.postsTbody.innerHTML = posts.map(post => {
      const categoryBadge = `<span class="badge ${categoryMap[post.category]?.badgeClass}">${categoryMap[post.category]?.name || post.category}</span>`;
      const fileIcon = post.has_file ? ` <span style="font-size:12px;">📎</span>` : '';
      const commentCount = post.comment_count > 0 ? ` <span class="comment-count-pill">[${post.comment_count}]</span>` : '';

      return `
        <tr data-id="${post.id}">
          <td>${categoryBadge}</td>
          <td>
            <div class="post-title-cell">
              <span>${escapeHtml(post.title)}</span>
              ${commentCount}
              ${fileIcon}
            </div>
          </td>
          <td>${escapeHtml(post.author)}</td>
          <td>${formatDate(post.created_at)}</td>
        </tr>
      `;
    }).join('');

    elements.postsTbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => openPostDetail(tr.getAttribute('data-id')));
    });
  }

  function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) {
      elements.paginationControls.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      const activeClass = i === currentPage ? 'active' : '';
      html += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }
    elements.paginationControls.innerHTML = html;

    elements.paginationControls.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.currentPage = Number(e.currentTarget.getAttribute('data-page'));
        loadPosts();
      });
    });
  }

  async function openPostDetail(id) {
    state.activePostId = id;
    try {
      const res = await fetch(`/api/posts/${id}`);
      const json = await res.json();

      if (json.success) {
        const post = json.data;
        elements.viewCategoryBadge.className = `badge ${categoryMap[post.category]?.badgeClass}`;
        elements.viewCategoryBadge.textContent = categoryMap[post.category]?.name || post.category;
        elements.viewTitle.textContent = post.title;
        elements.viewAuthor.textContent = post.author;
        elements.viewDate.textContent = formatDateFull(post.created_at);

        const isMarkdown = post.content_type === 'markdown';
        elements.viewContentTypeBadge.textContent = isMarkdown ? '📝 마크다운' : '📄 일반 텍스트';
        
        if (isMarkdown) {
          elements.viewContent.className = 'view-content-box markdown-body';
          elements.viewContent.innerHTML = parseMarkdown(post.content);
        } else {
          elements.viewContent.className = 'view-content-box';
          elements.viewContent.innerHTML = escapeHtml(post.content).replace(/\n/g, '<br>');
        }

        if (post.attachments && post.attachments.length > 0) {
          elements.viewAttachmentsSection.style.display = 'block';
          elements.viewAttachmentCards.innerHTML = post.attachments.map(att => `
            <a href="/api/download/${att.id}" class="attachment-card" target="_blank" download>
              <div class="attach-info">
                <div class="attach-name">📄 ${escapeHtml(att.original_name)}</div>
                <div class="attach-size">${formatBytes(att.file_size)}</div>
              </div>
              <span>⬇️ 다운로드</span>
            </a>
          `).join('');
        } else {
          elements.viewAttachmentsSection.style.display = 'none';
        }

        renderComments(post.comments || []);
        openModal(elements.modalViewPost);
      }
    } catch (err) {
      alert('게시글 불러오기 실패');
    }
  }

  function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    html = html.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    html = html.replace(/^---$/gim, '<hr>');

    html = html.replace(/^\s*[-*] (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\n<ul>/g, '');

    const lines = html.split('\n');
    let inPre = false;
    let result = lines.map(line => {
      if (line.includes('<pre>')) inPre = true;
      if (line.includes('</pre>')) inPre = false;
      if (!inPre && !line.startsWith('<h') && !line.startsWith('<ul') && !line.startsWith('<blockquote') && !line.startsWith('<hr')) {
        return line + '<br>';
      }
      return line;
    }).join('\n');

    return result;
  }

  function renderComments(comments) {
    elements.commentCountBadge.textContent = `(${comments.length})`;
    if (comments.length === 0) {
      elements.commentList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">댓글이 없습니다.</p>`;
      return;
    }

    elements.commentList.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author-name">${escapeHtml(c.author)}</span>
          <div>
            <span>${formatDate(c.created_at)}</span>
            <span class="comment-del-btn" data-cid="${c.id}"> [삭제]</span>
          </div>
        </div>
        <div class="comment-body">${escapeHtml(c.content)}</div>
      </div>
    `).join('');

    elements.commentList.querySelectorAll('.comment-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => handleDeleteComment(e.currentTarget.getAttribute('data-cid')));
    });
  }

  async function handleCreateComment() {
    const author = elements.commentAuthor.value.trim();
    const pinCode = elements.commentPin.value.trim();
    const content = elements.commentContent.value.trim();

    if (!author || !pinCode || !content) {
      alert('이름, 암호, 내용 필수 입력');
      return;
    }

    try {
      const res = await fetch(`/api/posts/${state.activePostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, pinCode, content })
      });
      const json = await res.json();
      if (json.success) {
        elements.commentContent.value = '';
        openPostDetail(state.activePostId);
      }
    } catch (err) {}
  }

  async function handleDeleteComment(commentId) {
    const pinCode = prompt('삭제 비밀번호:');
    if (!pinCode) return;

    try {
      const res = await fetch(`/api/comments/${commentId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode })
      });
      const json = await res.json();
      if (json.success) openPostDetail(state.activePostId);
      else alert(json.message);
    } catch (err) {}
  }

  async function handleCreatePostSubmit(e) {
    e.preventDefault();

    const formData = new FormData(elements.createPostForm);
    state.selectedFiles.forEach(file => formData.append('attachments', file));

    try {
      const res = await fetch('/api/posts', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        elements.createPostForm.reset();
        state.selectedFiles = [];
        renderFilePreviews();
        closeModal(elements.modalCreatePost);
        loadPosts();
      } else {
        alert(json.message);
      }
    } catch (err) {}
  }

  async function handleDeletePost() {
    if (!state.activePostId) return;
    const pinCode = prompt('삭제 비밀번호:');
    if (!pinCode) return;

    try {
      const res = await fetch(`/api/posts/${state.activePostId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode })
      });
      const json = await res.json();
      if (json.success) {
        closeModal(elements.modalViewPost);
        loadPosts();
      } else {
        alert(json.message);
      }
    } catch (err) {}
  }

  function addFiles(newFiles) {
    state.selectedFiles = [...state.selectedFiles, ...newFiles];
    renderFilePreviews();
  }

  function renderFilePreviews() {
    elements.filePreviewList.innerHTML = state.selectedFiles.map((file, idx) => `
      <div class="file-preview-item">
        <span>📄 ${escapeHtml(file.name)} (${formatBytes(file.size)})</span>
        <span class="file-remove-btn" data-idx="${idx}">&times;</span>
      </div>
    `).join('');

    elements.filePreviewList.querySelectorAll('.file-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        state.selectedFiles.splice(idx, 1);
        renderFilePreviews();
      });
    });
  }

  function openModal(modal) { modal.classList.add('active'); }
  function closeModal(modal) { modal.classList.remove('active'); }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDateFull(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
