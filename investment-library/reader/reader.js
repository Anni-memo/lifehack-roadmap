'use strict';

(function () {
  /* ==========================================================================
     Book Reader — reader.js  v2
     Pure JavaScript, no dependencies
     v2: side arrows, vertical text, swipe hint
     ========================================================================== */

  /* ---------- State ---------- */
  var book = null;
  var chapters = [];
  var currentChapterIndex = 0;
  var currentPage = 0;
  var totalPages = 1;
  var slug = '';
  var resizeTimer = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var isTransitioning = false;
  var writingMode = 'vertical'; // 'horizontal' or 'vertical' (default: vertical)
  var viewMode = 'paged'; // 'paged' or 'scroll'

  /* ---------- DOM refs ---------- */
  var app = document.getElementById('reader-app');
  var bookTitleEl = document.getElementById('book-title');
  var chapterTitleEl = document.getElementById('chapter-title');
  var tocPanel = document.getElementById('toc-panel');
  var tocList = document.getElementById('toc-list');
  var tocOverlay = document.getElementById('toc-overlay');
  var tocToggle = document.getElementById('toc-toggle');
  var settingsPanel = document.getElementById('settings-panel');
  var settingsOverlay = document.getElementById('settings-overlay');
  var settingsToggle = document.getElementById('settings-toggle');
  var pageContainer = document.getElementById('page-container');
  var pageContent = document.getElementById('page-content');
  var prevBtn = document.getElementById('prev-page');
  var nextBtn = document.getElementById('next-page');
  var tapPrev = document.getElementById('tap-prev');
  var tapNext = document.getElementById('tap-next');
  var navPrev = document.getElementById('nav-prev');
  var navNext = document.getElementById('nav-next');
  var progressFill = document.getElementById('progress-fill');
  var pageInfo = document.getElementById('page-info');
  var loadingEl = document.getElementById('reader-loading');
  var fontSizeSlider = document.getElementById('font-size-slider');
  var fontSizeValue = document.getElementById('font-size-value');
  var lineHeightSlider = document.getElementById('line-height-slider');
  var lineHeightValue = document.getElementById('line-height-value');

  /* ---------- Initialization ---------- */
  function init() {
    loadSettings();
    parseURL();

    if (!slug) {
      showError('書籍が指定されていません。');
      return;
    }

    fetchBookData();
    bindEvents();
    showSwipeHint();
    showReadingTime();
  }

  /* ---------- URL Parsing ---------- */
  function parseURL() {
    var params = new URLSearchParams(window.location.search);
    slug = params.get('book') || '';
  }

  /* ---------- Swipe Hint (first visit) ---------- */
  function showSwipeHint() {
    var key = 'reader-hint-shown';
    if (localStorage.getItem(key)) return;

    var hint = document.createElement('div');
    hint.id = 'swipe-hint';
    hint.textContent = '← スワイプ or 矢印キーでページ送り →';
    app.appendChild(hint);

    localStorage.setItem(key, '1');

    setTimeout(function () {
      if (hint.parentNode) hint.parentNode.removeChild(hint);
    }, 4500);
  }

  /* ---------- Fetch Book Data ---------- */
  function fetchBookData() {
    showLoading();

    fetch('../data/books/books.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load books.json');
        return res.json();
      })
      .then(function (books) {
        book = null;
        for (var i = 0; i < books.length; i++) {
          if (books[i].slug === slug) {
            book = books[i];
            break;
          }
        }

        if (!book) {
          showError('「' + slug + '」という書籍が見つかりません。');
          return;
        }

        chapters = book.chapters || [];
        bookTitleEl.textContent = book.title;
        document.title = book.title + ' | 投資と思考の書斎';

        buildTOC();
        checkSavedProgress();
      })
      .catch(function (err) {
        showError('データの読み込みに失敗しました。');
        console.error(err);
      });
  }

  /* ---------- Check Saved Progress ---------- */
  function checkSavedProgress() {
    // Scroll mode: load all chapters at once
    if (viewMode === 'scroll') {
      loadAllChaptersForScroll();
      return;
    }

    var saved = loadProgress();
    var params = new URLSearchParams(window.location.search);
    var requestedChapter = params.get('chapter');

    if (requestedChapter) {
      var idx = findChapterIndex(requestedChapter);
      if (idx >= 0) {
        loadChapter(idx, 0);
        return;
      }
    }

    if (saved && saved.chapter) {
      var chIdx = findChapterIndex(saved.chapter);
      if (chIdx >= 0 && (chIdx > 0 || saved.page > 0)) {
        showResumeBanner(chIdx, saved.page);
        loadChapter(0, 0);
        return;
      }
    }

    loadChapter(0, 0);
  }

  /* ---------- Resume Banner ---------- */
  function showResumeBanner(chapterIdx, page) {
    var banner = document.createElement('div');
    banner.id = 'resume-banner';
    banner.textContent = '前回の続きから読む →';
    banner.addEventListener('click', function () {
      banner.classList.add('hidden');
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 300);
      loadChapter(chapterIdx, page);
    });
    app.appendChild(banner);

    setTimeout(function () {
      if (banner.parentNode) {
        banner.classList.add('hidden');
        setTimeout(function () {
          if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 300);
      }
    }, 6000);
  }

  /* ---------- Chapter Loading ---------- */
  function loadChapter(index, startPage) {
    if (index < 0 || index >= chapters.length) return;

    showLoading();
    currentChapterIndex = index;
    var chapter = chapters[index];

    fetch('../data/books/' + chapter.file)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load chapter: ' + chapter.file);
        return res.text();
      })
      .then(function (html) {
        pageContent.innerHTML = html;
        pageContent.style.transform = writingMode === 'vertical' ? 'translateX(0)' : 'translateX(0)';

        chapterTitleEl.textContent = chapter.title;
        highlightTOC(index);

        requestAnimationFrame(function () {
          setTimeout(function () {
            paginate();
            var targetPage = (typeof startPage === 'number' && startPage >= 0) ? Math.min(startPage, totalPages - 1) : 0;
            goToPage(targetPage);
            hideLoading();
            saveProgress();
          }, 150);
        });
      })
      .catch(function (err) {
        pageContent.innerHTML = '<div class="reader-error"><h2>読み込みエラー</h2><p>この章を読み込めませんでした。</p></div>';
        hideLoading();
        console.error(err);
      });
  }

  /* ---------- Pagination Engine ---------- */
  function paginate() {
    var containerWidth = pageContainer.offsetWidth;
    var containerHeight = pageContainer.offsetHeight;
    if (containerWidth <= 0) return;

    // Reset transform
    pageContent.style.transition = 'none';
    pageContent.style.transform = 'translateX(0)';
    void pageContent.offsetHeight;

    if (writingMode === 'vertical') {
      // Vertical mode: content flows right-to-left, scrollWidth is total width
      var totalW = pageContent.scrollWidth;
      totalPages = Math.max(1, Math.ceil(totalW / containerWidth));
    } else {
      // Horizontal mode: CSS columns create horizontal overflow
      var totalWidth = pageContent.scrollWidth;
      totalPages = Math.max(1, Math.ceil(totalWidth / containerWidth));
    }

    requestAnimationFrame(function () {
      pageContent.style.transition = 'transform 0.35s ease';
    });
  }

  function goToPage(page) {
    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;

    currentPage = page;
    var containerWidth = pageContainer.offsetWidth;

    if (writingMode === 'vertical') {
      // Vertical-rl: page 0 = right edge (no shift), page N = shift right to reveal left content
      var offset = page * containerWidth;
      pageContent.style.transform = 'translateX(' + offset + 'px)';
    } else {
      var offset = -page * containerWidth;
      pageContent.style.transform = 'translateX(' + offset + 'px)';
    }

    updateProgress();
    saveProgress();

    isTransitioning = true;
    setTimeout(function () { isTransitioning = false; }, 350);
  }

  /* ---------- Navigation ---------- */
  function nextPage() {
    if (isTransitioning) return;

    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      loadChapter(currentChapterIndex + 1, 0);
    }
  }

  function prevPage() {
    if (isTransitioning) return;

    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else if (currentChapterIndex > 0) {
      loadChapter(currentChapterIndex - 1, 99999);
    }
  }

  /* ---------- Progress ---------- */
  function updateProgress() {
    var chapterFraction = totalPages > 0 ? (currentPage + 1) / totalPages : 1;
    var overallProgress = (currentChapterIndex + chapterFraction) / chapters.length;
    overallProgress = Math.min(1, Math.max(0, overallProgress));

    progressFill.style.width = (overallProgress * 100).toFixed(1) + '%';
    pageInfo.textContent = '第' + (currentChapterIndex + 1) + '章 — ' + (currentPage + 1) + ' / ' + totalPages + ' ページ';
  }

  /* ---------- Writing Mode ---------- */
  function setWritingMode(mode) {
    writingMode = mode;
    if (mode === 'vertical') {
      app.setAttribute('data-writing', 'vertical');
    } else {
      app.removeAttribute('data-writing');
    }

    try { localStorage.setItem('reader-writingMode', mode); } catch (e) { /* */ }

    // Update buttons
    var btns = document.querySelectorAll('.writing-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-writing') === mode);
    }

    // Repaginate (only in paged mode)
    if (viewMode === 'paged') {
      setTimeout(function () {
        paginate();
        goToPage(0);
      }, 100);
    }
  }

  /* ---------- View Mode ---------- */
  function setViewMode(mode) {
    viewMode = mode;
    document.documentElement.setAttribute('data-view', mode);
    app.setAttribute('data-view', mode);
    try { localStorage.setItem('reader-viewMode', mode); } catch (e) { /* */ }

    var btns = document.querySelectorAll('.view-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === mode);
    }

    if (mode === 'scroll') {
      loadAllChaptersForScroll();
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
    } else {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
      loadChapter(currentChapterIndex, 0);
    }
  }

  function loadAllChaptersForScroll() {
    showLoading();
    var promises = [];
    for (var i = 0; i < chapters.length; i++) {
      promises.push(fetch('../data/books/' + chapters[i].file).then(function (r) { return r.text(); }));
    }

    Promise.all(promises).then(function (htmls) {
      var combined = '';
      for (var i = 0; i < htmls.length; i++) {
        if (i > 0) {
          combined += '<div class="scroll-chapter-divider"></div>';
        }
        combined += htmls[i];
      }
      pageContent.innerHTML = combined;
      pageContent.style.transform = 'none';
      hideLoading();
      initScrollProgress();
    }).catch(function () {
      pageContent.innerHTML = '<div class="reader-error"><h2>読み込みエラー</h2></div>';
      hideLoading();
    });
  }

  function initScrollProgress() {
    var fill = document.getElementById('scroll-progress-fill');
    if (!fill) return;

    function updateScrollBar() {
      if (viewMode !== 'scroll') return;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      fill.style.width = pct.toFixed(1) + '%';
    }

    window.addEventListener('scroll', updateScrollBar, { passive: true });
    updateScrollBar();
  }

  /* ---------- localStorage ---------- */
  function saveProgress() {
    if (!slug || !chapters[currentChapterIndex]) return;
    var data = {
      chapter: chapters[currentChapterIndex].id,
      page: currentPage,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('reader-progress-' + slug, JSON.stringify(data));
    } catch (e) { /* quota exceeded */ }
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem('reader-progress-' + slug);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function loadSettings() {
    // Theme
    var savedTheme = localStorage.getItem('reader-theme');
    if (savedTheme) applyTheme(savedTheme);

    // Font size
    var savedFontSize = localStorage.getItem('reader-fontSize');
    if (savedFontSize) {
      var fs = parseInt(savedFontSize, 10);
      if (fs >= 14 && fs <= 24) {
        app.style.setProperty('--font-size', fs + 'px');
        fontSizeSlider.value = fs;
        fontSizeValue.textContent = fs + 'px';
      }
    }

    // Line height
    var savedLineHeight = localStorage.getItem('reader-lineHeight');
    if (savedLineHeight) {
      var lh = parseFloat(savedLineHeight);
      if (lh >= 1.6 && lh <= 2.8) {
        app.style.setProperty('--line-height', lh);
        lineHeightSlider.value = lh;
        lineHeightValue.textContent = lh.toFixed(1);
      }
    }

    // Writing mode (default: vertical)
    var savedWriting = localStorage.getItem('reader-writingMode');
    if (savedWriting === 'horizontal') {
      writingMode = 'horizontal';
      app.removeAttribute('data-writing');
      document.documentElement.removeAttribute('data-writing');
    } else {
      writingMode = 'vertical';
      app.setAttribute('data-writing', 'vertical');
      document.documentElement.setAttribute('data-writing', 'vertical');
    }
    var wbtns = document.querySelectorAll('.writing-btn');
    for (var i = 0; i < wbtns.length; i++) {
      wbtns[i].classList.toggle('active', wbtns[i].getAttribute('data-writing') === writingMode);
    }

    // View mode
    var savedView = localStorage.getItem('reader-viewMode');
    if (savedView === 'scroll') {
      viewMode = 'scroll';
      document.documentElement.setAttribute('data-view', 'scroll');
      app.setAttribute('data-view', 'scroll');
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
      var vbtns = document.querySelectorAll('.view-btn');
      for (var i = 0; i < vbtns.length; i++) {
        vbtns[i].classList.toggle('active', vbtns[i].getAttribute('data-view') === 'scroll');
      }
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    app.setAttribute('data-theme', theme);
    try { localStorage.setItem('reader-theme', theme); } catch (e) { /* */ }

    var btns = document.querySelectorAll('.theme-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-theme') === theme);
    }
  }

  /* ---------- TOC ---------- */
  function buildTOC() {
    tocList.innerHTML = '';
    for (var i = 0; i < chapters.length; i++) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#';
      a.setAttribute('data-index', i);

      var numSpan = document.createElement('span');
      numSpan.className = 'toc-chapter-num';
      numSpan.textContent = '第' + (i + 1) + '章';

      a.appendChild(numSpan);
      a.appendChild(document.createTextNode(chapters[i].title));

      a.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(this.getAttribute('data-index'), 10);
        loadChapter(idx, 0);
        closeTOC();
      });

      li.appendChild(a);
      tocList.appendChild(li);
    }
  }

  function highlightTOC(activeIndex) {
    var items = tocList.querySelectorAll('li');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === activeIndex);
    }
  }

  function openTOC() { tocPanel.classList.add('open'); tocOverlay.classList.add('active'); }
  function closeTOC() { tocPanel.classList.remove('open'); tocOverlay.classList.remove('active'); }
  function toggleTOC() {
    if (tocPanel.classList.contains('open')) { closeTOC(); }
    else { closeSettings(); openTOC(); }
  }

  /* ---------- Settings ---------- */
  function openSettings() { settingsPanel.classList.add('open'); settingsOverlay.classList.add('active'); }
  function closeSettings() { settingsPanel.classList.remove('open'); settingsOverlay.classList.remove('active'); }
  function toggleSettings() {
    if (settingsPanel.classList.contains('open')) { closeSettings(); }
    else { closeTOC(); openSettings(); }
  }

  /* ---------- UI Helpers ---------- */
  function showLoading() { loadingEl.classList.remove('hidden'); }
  function hideLoading() { loadingEl.classList.add('hidden'); }

  function showError(message) {
    hideLoading();
    pageContent.innerHTML = '';
    var errorDiv = document.createElement('div');
    errorDiv.className = 'reader-error';
    errorDiv.innerHTML = '<h2>エラー</h2><p>' + escapeHTML(message) + '</p><a href="../classics/">書斎に戻る</a>';
    pageContent.appendChild(errorDiv);
    chapterTitleEl.textContent = '';
    bookTitleEl.textContent = '';
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function findChapterIndex(chapterId) {
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === chapterId) return i;
    }
    return -1;
  }

  /* ---------- Reading Time ---------- */
  function showReadingTime() {
    var el = document.getElementById('reading-time');
    if (!el || !book) return;
    // Estimate: ~500 chars/min for Japanese
    var totalChars = 0;
    var counted = 0;
    var promises = [];
    for (var i = 0; i < chapters.length; i++) {
      promises.push(fetch('../data/books/' + chapters[i].file).then(function(r){ return r.text(); }));
    }
    Promise.all(promises).then(function(htmls) {
      for (var i = 0; i < htmls.length; i++) {
        var tmp = document.createElement('div');
        tmp.innerHTML = htmls[i];
        totalChars += (tmp.textContent || '').replace(/\s/g, '').length;
      }
      var mins = Math.max(1, Math.round(totalChars / 500));
      el.textContent = '読了目安 ' + mins + '分';
      el.classList.add('visible');
    });
  }

  /* ---------- Notes (Reading Clippings) ---------- */
  var notesPanel = document.getElementById('notes-panel');
  var notesList = document.getElementById('notes-list');
  var notesEmpty = document.getElementById('notes-empty');
  var notesOverlay = document.getElementById('notes-overlay');
  var selectionPopup = document.getElementById('selection-popup');

  function getNotesKey() { return 'reader-notes-' + slug; }

  function loadNotes() {
    try {
      var raw = localStorage.getItem(getNotesKey());
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveNotes(notes) {
    try { localStorage.setItem(getNotesKey(), JSON.stringify(notes)); } catch(e) {}
  }

  function addNote(text) {
    if (!text || !text.trim()) return;
    var notes = loadNotes();
    notes.push({
      text: text.trim(),
      chapter: chapters[currentChapterIndex] ? chapters[currentChapterIndex].title : '',
      date: new Date().toISOString().slice(0,10)
    });
    saveNotes(notes);
    renderNotes();
    showToast('保存しました');
  }

  function deleteNote(index) {
    var notes = loadNotes();
    notes.splice(index, 1);
    saveNotes(notes);
    renderNotes();
  }

  function renderNotes() {
    var notes = loadNotes();
    notesList.innerHTML = '';
    notesEmpty.style.display = notes.length === 0 ? 'block' : 'none';

    for (var i = 0; i < notes.length; i++) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="note-text">' + escapeHTML(notes[i].text) + '</div>' +
        '<div class="note-meta">' + escapeHTML(notes[i].chapter) + ' · ' + notes[i].date + '</div>' +
        '<div class="note-actions">' +
          '<button data-action="copy" data-index="' + i + '" title="コピー">&#128203;</button>' +
          '<button data-action="share" data-index="' + i + '" title="共有">&#8599;</button>' +
          '<button data-action="delete" data-index="' + i + '" title="削除">&#10005;</button>' +
        '</div>';
      notesList.appendChild(li);
    }
  }

  function getAllNotesText() {
    var notes = loadNotes();
    if (notes.length === 0) return '';
    var lines = ['【読書ノート】' + (book ? book.title : ''), ''];
    for (var i = 0; i < notes.length; i++) {
      lines.push('▸ ' + notes[i].text);
      lines.push('  (' + notes[i].chapter + ' · ' + notes[i].date + ')');
      lines.push('');
    }
    lines.push('#投資と思考の書斎');
    return lines.join('\n');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('コピーしました');
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('コピーしました');
    }
  }

  function shareText(text) {
    if (navigator.share) {
      navigator.share({ text: text }).catch(function(){});
    } else {
      showShareMenu(text);
    }
  }

  function showShareMenu(text) {
    var existing = document.getElementById('share-menu');
    if (existing) existing.remove();

    var encoded = encodeURIComponent(text);
    var menu = document.createElement('div');
    menu.id = 'share-menu';
    menu.innerHTML =
      '<div class="share-menu-title">共有先を選ぶ</div>' +
      '<a href="https://line.me/R/share?text=' + encoded + '" target="_blank" rel="noopener">LINE</a>' +
      '<a href="mailto:?body=' + encoded + '" target="_blank">メール</a>' +
      '<a href="https://twitter.com/intent/tweet?text=' + encoded + '" target="_blank" rel="noopener">X (Twitter)</a>' +
      '<button id="share-menu-copy">クリップボードにコピー</button>' +
      '<button id="share-menu-close">閉じる</button>';
    app.appendChild(menu);

    document.getElementById('share-menu-copy').addEventListener('click', function() {
      copyToClipboard(text);
      menu.remove();
    });
    document.getElementById('share-menu-close').addEventListener('click', function() {
      menu.remove();
    });
  }

  function showToast(msg) {
    var existing = document.querySelector('.reader-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'reader-toast';
    t.textContent = msg;
    app.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 2200);
  }

  function openNotes() {
    renderNotes();
    notesPanel.classList.add('open');
    notesOverlay.classList.add('active');
  }

  function closeNotes() {
    notesPanel.classList.remove('open');
    notesOverlay.classList.remove('active');
  }

  /* Selection popup positioning */
  function showSelectionPopup() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      selectionPopup.classList.remove('visible');
      return;
    }
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    selectionPopup.style.top = (rect.top - 40) + 'px';
    selectionPopup.style.left = Math.max(8, Math.min(window.innerWidth - 200, rect.left + rect.width / 2 - 80)) + 'px';
    selectionPopup.classList.add('visible');
  }

  function hideSelectionPopup() {
    selectionPopup.classList.remove('visible');
  }

  /* ---------- Event Binding ---------- */
  function bindEvents() {
    // Footer navigation buttons
    prevBtn.addEventListener('click', function () { prevPage(); });
    nextBtn.addEventListener('click', function () { nextPage(); });

    // Side navigation arrows
    navPrev.addEventListener('click', function () { prevPage(); });
    navNext.addEventListener('click', function () { nextPage(); });

    // Tap zones
    tapPrev.addEventListener('click', function () { prevPage(); });
    tapNext.addEventListener('click', function () { nextPage(); });

    // TOC
    tocToggle.addEventListener('click', function () { toggleTOC(); });
    tocOverlay.addEventListener('click', function () { closeTOC(); });

    // Settings
    settingsToggle.addEventListener('click', function () { toggleSettings(); });
    settingsOverlay.addEventListener('click', function () { closeSettings(); });

    // Notes panel
    document.getElementById('notes-toggle').addEventListener('click', function() {
      if (notesPanel.classList.contains('open')) { closeNotes(); }
      else { closeTOC(); closeSettings(); openNotes(); }
    });
    document.getElementById('notes-close').addEventListener('click', function() { closeNotes(); });
    notesOverlay.addEventListener('click', function() { closeNotes(); });

    // Notes actions
    document.getElementById('notes-copy-all').addEventListener('click', function() {
      var text = getAllNotesText();
      if (text) copyToClipboard(text);
    });
    document.getElementById('notes-share-all').addEventListener('click', function() {
      var text = getAllNotesText();
      if (text) shareText(text);
    });
    document.getElementById('notes-clear').addEventListener('click', function() {
      if (loadNotes().length > 0) {
        saveNotes([]);
        renderNotes();
        showToast('削除しました');
      }
    });

    // Notes list delegation
    notesList.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var idx = parseInt(btn.getAttribute('data-index'), 10);
      var notes = loadNotes();
      if (action === 'copy' && notes[idx]) copyToClipboard(notes[idx].text);
      if (action === 'share' && notes[idx]) shareText(notes[idx].text);
      if (action === 'delete') deleteNote(idx);
    });

    // Selection popup
    document.addEventListener('mouseup', function() { setTimeout(showSelectionPopup, 50); });
    document.addEventListener('touchend', function() { setTimeout(showSelectionPopup, 200); });
    document.addEventListener('mousedown', function(e) {
      if (!selectionPopup.contains(e.target)) hideSelectionPopup();
    });

    document.getElementById('save-selection').addEventListener('click', function() {
      var sel = window.getSelection();
      if (sel) { addNote(sel.toString()); sel.removeAllRanges(); }
      hideSelectionPopup();
    });
    document.getElementById('copy-selection').addEventListener('click', function() {
      var sel = window.getSelection();
      if (sel) copyToClipboard(sel.toString());
      hideSelectionPopup();
    });
    document.getElementById('share-selection').addEventListener('click', function() {
      var sel = window.getSelection();
      if (sel) shareText(sel.toString());
      hideSelectionPopup();
    });

    // Theme buttons
    var themeBtns = document.querySelectorAll('.theme-btn');
    for (var i = 0; i < themeBtns.length; i++) {
      themeBtns[i].addEventListener('click', function () {
        applyTheme(this.getAttribute('data-theme'));
      });
    }

    // Writing mode buttons
    var writingBtns = document.querySelectorAll('.writing-btn');
    for (var i = 0; i < writingBtns.length; i++) {
      writingBtns[i].addEventListener('click', function () {
        setWritingMode(this.getAttribute('data-writing'));
      });
    }

    // View mode buttons
    var viewBtns = document.querySelectorAll('.view-btn');
    for (var i = 0; i < viewBtns.length; i++) {
      viewBtns[i].addEventListener('click', function () {
        setViewMode(this.getAttribute('data-view'));
      });
    }

    // Font size slider
    fontSizeSlider.addEventListener('input', function () {
      var val = parseInt(this.value, 10);
      fontSizeValue.textContent = val + 'px';
      app.style.setProperty('--font-size', val + 'px');
      try { localStorage.setItem('reader-fontSize', val); } catch (e) { /* */ }
      debouncedRepaginate();
    });

    // Line height slider
    lineHeightSlider.addEventListener('input', function () {
      var val = parseFloat(this.value);
      lineHeightValue.textContent = val.toFixed(1);
      app.style.setProperty('--line-height', val);
      try { localStorage.setItem('reader-lineHeight', val); } catch (e) { /* */ }
      debouncedRepaginate();
    });

    // Keyboard
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextPage();
          break;
        case 'Escape':
          if (tocPanel.classList.contains('open')) { closeTOC(); }
          else if (settingsPanel.classList.contains('open')) { closeSettings(); }
          break;
        case 't':
        case 'T':
          toggleTOC();
          break;
      }
    });

    // Touch swipe
    var viewport = document.getElementById('reader-viewport');
    viewport.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    viewport.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) { nextPage(); }
        else { prevPage(); }
      }
    }, { passive: true });

    // Resize
    window.addEventListener('resize', function () { debouncedRepaginate(); });

    // Set initial theme active state
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(currentTheme);
  }

  /* ---------- Debounced Repaginate ---------- */
  function debouncedRepaginate() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var ratio = totalPages > 1 ? currentPage / (totalPages - 1) : 0;
      paginate();
      var newPage = Math.round(ratio * (totalPages - 1));
      goToPage(newPage);
    }, 200);
  }

  /* ---------- Start ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
