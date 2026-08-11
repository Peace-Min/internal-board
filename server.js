const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// 디렉터리 생성 보장
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

class MinimalBoardEngine {
  constructor() {
    this.dbFile = path.join(DATA_DIR, 'board_repository.json');
    this.state = {
      postSeq: 1,
      commentSeq: 1,
      fileSeq: 1,
      posts: [],
      comments: [],
      attachments: []
    };
    this.initStorage();
  }

  initStorage() {
    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        this.state = JSON.parse(raw);
      } catch (err) {
        this.persist();
      }
    } else {
      this.persist();
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[Engine] Persist error:', err.message);
    }
  }

  getPosts({ category, keyword, searchType = 'all', page = 1, limit = 15 }) {
    let list = this.state.posts;
    if (category && category !== 'all') {
      list = list.filter(p => p.category === category);
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter(p => {
        const inTitle = (p.title || '').toLowerCase().includes(kw);
        const inAuthor = (p.author || '').toLowerCase().includes(kw);
        const inContent = (p.content || '').toLowerCase().includes(kw);

        const fileList = this.state.attachments.filter(a => a.post_id === p.id);
        const inFile = fileList.some(f => (f.original_name || '').toLowerCase().includes(kw));

        const commentList = this.state.comments.filter(c => c.post_id === p.id);
        const inComment = commentList.some(c => (c.content || '').toLowerCase().includes(kw));
        const inCommentAuthor = commentList.some(c => (c.author || '').toLowerCase().includes(kw));

        if (searchType === 'title') return inTitle;
        if (searchType === 'author') return inAuthor || inCommentAuthor;
        if (searchType === 'file') return inFile;
        if (searchType === 'comment') return inComment;

        return inTitle || inAuthor || inContent || inFile || inComment;
      });
    }

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const totalCount = list.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = list.slice(startIndex, startIndex + limit);

    const items = paginatedItems.map(p => {
      const commentCount = this.state.comments.filter(c => c.post_id === p.id).length;
      const fileList = this.state.attachments.filter(a => a.post_id === p.id);
      return {
        id: p.id,
        category: p.category,
        title: p.title,
        author: p.author,
        created_at: p.created_at,
        comment_count: commentCount,
        has_file: fileList.length > 0
      };
    });

    return {
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / limit) || 1,
      posts: items
    };
  }

  getPostById(id) {
    const post = this.state.posts.find(p => p.id === Number(id));
    if (!post) return null;

    const comments = this.state.comments.filter(c => c.post_id === post.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const attachments = this.state.attachments.filter(a => a.post_id === post.id);

    return {
      id: post.id,
      category: post.category,
      title: post.title,
      content: post.content,
      content_type: post.content_type || 'text', // 'text' | 'markdown'
      author: post.author,
      created_at: post.created_at,
      comments,
      attachments
    };
  }

  createPost({ category, title, content, contentType = 'text', author, pinCode, files = [] }) {
    const newPost = {
      id: this.state.postSeq++,
      category,
      title,
      content,
      content_type: contentType, // 일반 텍스트(text) vs 마크다운(markdown)
      author,
      pin_code_hash: this.hashPin(pinCode),
      created_at: new Date().toISOString()
    };

    this.state.posts.push(newPost);

    for (const f of files) {
      let originalName = f.originalname;
      try {
        originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      } catch (e) {}

      this.state.attachments.push({
        id: this.state.fileSeq++,
        post_id: newPost.id,
        original_name: originalName,
        saved_name: f.filename,
        storage_path: f.path,
        file_size: f.size,
        mime_type: f.mimetype,
        created_at: new Date().toISOString()
      });
    }

    this.persist();
    return newPost;
  }

  deletePost(id, inputPinCode) {
    const idx = this.state.posts.findIndex(p => p.id === Number(id));
    if (idx === -1) return { success: false, reason: 'not_found' };

    const targetPost = this.state.posts[idx];
    if (targetPost.pin_code_hash !== this.hashPin(inputPinCode)) {
      return { success: false, reason: 'invalid_pin' };
    }

    const relatedFiles = this.state.attachments.filter(a => a.post_id === targetPost.id);
    for (const fileItem of relatedFiles) {
      if (fs.existsSync(fileItem.storage_path)) {
        try { fs.unlinkSync(fileItem.storage_path); } catch (e) {}
      }
    }

    this.state.attachments = this.state.attachments.filter(a => a.post_id !== targetPost.id);
    this.state.comments = this.state.comments.filter(c => c.post_id !== targetPost.id);
    this.state.posts.splice(idx, 1);

    this.persist();
    return { success: true };
  }

  createComment({ postId, author, content, pinCode }) {
    const newComment = {
      id: this.state.commentSeq++,
      post_id: Number(postId),
      author,
      content,
      pin_code_hash: this.hashPin(pinCode),
      created_at: new Date().toISOString()
    };
    this.state.comments.push(newComment);
    this.persist();
    return newComment;
  }

  deleteComment(commentId, inputPinCode) {
    const idx = this.state.comments.findIndex(c => c.id === Number(commentId));
    if (idx === -1) return { success: false, reason: 'not_found' };

    if (this.state.comments[idx].pin_code_hash !== this.hashPin(inputPinCode)) {
      return { success: false, reason: 'invalid_pin' };
    }

    this.state.comments.splice(idx, 1);
    this.persist();
    return { success: true };
  }

  getFileRecord(fileId) {
    return this.state.attachments.find(a => a.id === Number(fileId)) || null;
  }

  hashPin(pin) {
    return crypto.createHash('sha256').update(String(pin || '1234')).digest('hex');
  }
}

const dbEngine = new MinimalBoardEngine();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2000 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/posts', (req, res) => {
  try {
    const { category, keyword, searchType, page, limit } = req.query;
    res.json({ success: true, data: dbEngine.getPosts({ category, keyword, searchType, page, limit }) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/posts/:id', (req, res) => {
  try {
    const post = dbEngine.getPostById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: '게시글이 존재하지 않습니다.' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/posts', upload.array('attachments', 10), (req, res) => {
  try {
    const { category, title, content, contentType, author, pinCode } = req.body;
    if (!category || !title || !content || !author || !pinCode) {
      return res.status(400).json({ success: false, message: '필수 입력값이 누락되었습니다.' });
    }

    const created = dbEngine.createPost({
      category,
      title,
      content,
      contentType: contentType || 'text',
      author,
      pinCode,
      files: req.files || []
    });

    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/posts/:id/delete', (req, res) => {
  try {
    const result = dbEngine.deletePost(req.params.id, req.body.pinCode);
    if (!result.success) {
      return res.status(401).json({ success: false, message: '비밀번호 불일치' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/posts/:id/comments', (req, res) => {
  try {
    const { author, content, pinCode } = req.body;
    if (!author || !content || !pinCode) {
      return res.status(400).json({ success: false, message: '작성자, 내용, 비밀번호를 입력해주세요.' });
    }
    const comment = dbEngine.createComment({ postId: req.params.id, author, content, pinCode });
    res.json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/comments/:id/delete', (req, res) => {
  try {
    const result = dbEngine.deleteComment(req.params.id, req.body.pinCode);
    if (!result.success) {
      return res.status(401).json({ success: false, message: '비밀번호 불일치' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/download/:fileId', (req, res) => {
  try {
    const fileItem = dbEngine.getFileRecord(req.params.fileId);
    if (!fileItem || !fs.existsSync(fileItem.storage_path)) {
      return res.status(404).send('파일을 찾을 수 없습니다.');
    }

    res.setHeader('Content-Type', fileItem.mime_type || 'application/octet-stream');
    const encodedName = encodeURIComponent(fileItem.original_name);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);

    fs.createReadStream(fileItem.storage_path).pipe(res);
  } catch (err) {
    res.status(500).send('다운로드 에러');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ContentType Board Server Running] Port: ${PORT}`);
});
