/* ══════════════════════════════════════════════
   投資と思考の書斎 — 共有JavaScript
   ダークモード・検索・目次・共有ボタン・読了時間
   ══════════════════════════════════════════════ */

(function(){
'use strict';

// ── ダークモード ──
function initDarkMode(){
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(saved === 'dark' || (!saved && prefersDark)){
    document.documentElement.setAttribute('data-theme','dark');
  }
  // ボタンを作成
  var btn = document.createElement('button');
  btn.className = 'dark-mode-toggle';
  btn.title = 'ダークモード切替';
  btn.setAttribute('aria-label','ダークモード切替');
  updateDarkBtn(btn);
  btn.addEventListener('click', function(){
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme','light');
    } else {
      document.documentElement.setAttribute('data-theme','dark');
      localStorage.setItem('theme','dark');
    }
    updateDarkBtn(btn);
  });
  document.body.appendChild(btn);
}
function updateDarkBtn(btn){
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '\u2600' : '\u263D';
}

// ── 読了時間 ──
function initReadingTime(){
  var article = document.querySelector('.article, .article-body, main');
  if(!article) return;
  var text = article.textContent || '';
  var charCount = text.replace(/\s/g,'').length;
  // 日本語は400〜600文字/分、500で計算
  var minutes = Math.max(1, Math.round(charCount / 500));
  var el = document.createElement('div');
  el.className = 'reading-time-badge';
  el.textContent = '\u231A \u8AAD\u4E86\u76EE\u5B89\uFF1A' + minutes + '\u5206';
  // heroの直後に挿入
  var hero = document.querySelector('.hero');
  if(hero && hero.nextSibling){
    hero.parentNode.insertBefore(el, hero.nextSibling);
  }
}

// ── 自動目次（Table of Contents） ──
function initTOC(){
  var article = document.querySelector('.article');
  if(!article) return;
  var headings = article.querySelectorAll('h2, h3');
  if(headings.length < 3) return;
  // 既存のTOCがある場合はスキップ
  if(document.querySelector('.toc')) return;

  var toc = document.createElement('div');
  toc.className = 'auto-toc';
  var label = document.createElement('div');
  label.className = 'auto-toc-label';
  label.textContent = '\u76EE\u6B21';
  toc.appendChild(label);
  var list = document.createElement('ul');
  list.className = 'auto-toc-list';
  headings.forEach(function(h, i){
    if(!h.id) h.id = 'section-' + i;
    var li = document.createElement('li');
    li.className = h.tagName === 'H3' ? 'auto-toc-sub' : '';
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });
  toc.appendChild(list);
  // article冒頭に挿入
  article.insertBefore(toc, article.firstChild);
}

// ── X共有ボタン ──
function initShareButton(){
  var footer = document.querySelector('.footer');
  if(!footer) return;
  var title = document.title.split('\uFF5C')[0].trim();
  var url = window.location.href;
  var shareText = '\u300C' + title + '\u300D\n\n' + url + '\n\n#\u6295\u8CC7\u3068\u601D\u8003\u306E\u66F8\u658E';
  var container = document.createElement('div');
  container.className = 'share-section';
  container.innerHTML =
    '<div class="share-label">SHARE THIS ARTICLE</div>' +
    '<a class="share-x-btn" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
    ' X\u3067\u5171\u6709\u3059\u308B</a>';
  footer.parentNode.insertBefore(container, footer);
}

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', function(){
  initDarkMode();
  initReadingTime();
  initTOC();
  initShareButton();
});

})();
