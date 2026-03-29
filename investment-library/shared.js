/* ══════════════════════════════════════════════
   投資と思考の書斎 — 共有JavaScript
   ダークモード・検索・目次・共有ボタン・読了時間
   SPA風ナビゲーション・音楽プレーヤー
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
  // 既存ボタンがあれば削除（SPA再実行対策）
  var existing = document.querySelector('.dark-mode-toggle');
  if(existing) existing.remove();
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
  var minutes = Math.max(1, Math.round(charCount / 500));
  var el = document.createElement('div');
  el.className = 'reading-time-badge';
  el.textContent = '\u231A \u8AAD\u4E86\u76EE\u5B89\uFF1A' + minutes + '\u5206';
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
  article.insertBefore(toc, article.firstChild);
}

// ── X共有ボタン ──
function initShareButton(){
  var footer = document.querySelector('.footer');
  if(!footer) return;
  if(document.querySelector('.share-section')) return;
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

// ══════════════════════════════════════════════
// ── 528Hz 音楽プレーヤー（全ページ共通・SPA対応） ──
// ══════════════════════════════════════════════

var MUSIC_STORAGE_KEY = 'music_playing';
var MUSIC_VIDEO_ID = 't_8uSnwvUeQ';
var musicPlayer = null;
var musicPlayerReady = false;
var musicApiLoaded = false;

function initMusicPlayer(){
  // 既にDOMにある場合はスキップ（SPAでの再実行防止）
  if(document.getElementById('spa-music-player')) return;

  // コンテナを作成してbody末尾に追加
  var container = document.createElement('div');
  container.id = 'spa-music-player';
  container.innerHTML =
    '<button class="music-toggle" id="musicToggle" title="528Hz アンビエント音楽">\uD83C\uDFB5</button>' +
    '<div id="yt-player-container" style="display:none;"></div>';
  document.body.appendChild(container);

  var btn = document.getElementById('musicToggle');
  var shouldPlay = localStorage.getItem(MUSIC_STORAGE_KEY) === 'true';

  // YouTube IFrame APIが既にロード済みなら直接初期化
  if(window.YT && window.YT.Player){
    createYTPlayer(btn, shouldPlay);
  } else if(!musicApiLoaded){
    // API未ロード時
    window.onYouTubeIframeAPIReady = function(){
      createYTPlayer(btn, shouldPlay);
    };
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    musicApiLoaded = true;
  }

  btn.addEventListener('click', function(){
    if(!musicPlayerReady) return;
    if(musicPlayer.getPlayerState() === YT.PlayerState.PLAYING){
      musicPlayer.pauseVideo();
      btn.classList.remove('playing');
      localStorage.setItem(MUSIC_STORAGE_KEY, 'false');
    } else {
      musicPlayer.playVideo();
      btn.classList.add('playing');
      localStorage.setItem(MUSIC_STORAGE_KEY, 'true');
    }
  });
}

function createYTPlayer(btn, shouldPlay){
  if(musicPlayer) return; // 既に作成済み
  musicPlayer = new YT.Player('yt-player-container', {
    height: '1', width: '1',
    videoId: MUSIC_VIDEO_ID,
    playerVars: {autoplay: 0, loop: 1, playlist: MUSIC_VIDEO_ID},
    events: {
      onReady: function(e){
        musicPlayerReady = true;
        e.target.setVolume(30);
        if(shouldPlay){
          e.target.playVideo();
          btn.classList.add('playing');
        }
      }
    }
  });
}

// ══════════════════════════════════════════════
// ── SPA風ナビゲーション ──
// ══════════════════════════════════════════════

var SPA_ENABLED = true;
var spaNavigating = false;

function getBaseUrl(){
  // サイトのベースURL（/investment-library/ など）
  var base = document.querySelector('link[rel="canonical"]');
  if(base){
    var url = new URL(base.href);
    // パスのルート部分を取得
    var match = url.pathname.match(/^(\/[^\/]+\/)/);
    return match ? match[1] : '/';
  }
  // フォールバック：現在のパスから推測
  var path = window.location.pathname;
  var match = path.match(/^(\/[^\/]+\/)/);
  return match ? match[1] : '/';
}

function isSameOriginLink(a){
  if(!a || !a.href) return false;
  if(a.target === '_blank' || a.target === '_new') return false;
  if(a.hasAttribute('download')) return false;
  if(a.href.indexOf('mailto:') === 0 || a.href.indexOf('tel:') === 0) return false;
  if(a.href.indexOf('javascript:') === 0) return false;
  // 外部リンクを除外
  if(a.hostname !== window.location.hostname) return false;
  // .json, .txt, .pdf, .xml 等のファイルを除外
  if(/\.(json|txt|pdf|xml|png|jpg|jpeg|gif|svg|zip|csv)(\?|$)/i.test(a.pathname)) return false;
  // ハッシュのみのリンクを除外
  if(a.pathname === window.location.pathname && a.hash) return false;
  return true;
}

function spaNavigate(url, pushState){
  if(spaNavigating) return;
  spaNavigating = true;

  // ローディング表示
  var loader = document.getElementById('spa-loader');
  if(!loader){
    loader = document.createElement('div');
    loader.id = 'spa-loader';
    loader.style.cssText = 'position:fixed;top:0;left:0;width:0;height:2px;background:var(--gold3,#d4aa22);z-index:9999;transition:width .3s;';
    document.body.appendChild(loader);
  }
  loader.style.width = '30%';

  fetch(url)
    .then(function(response){
      if(!response.ok) throw new Error('HTTP ' + response.status);
      loader.style.width = '60%';
      return response.text();
    })
    .then(function(html){
      loader.style.width = '90%';

      // 新しいDOMをパース
      var parser = new DOMParser();
      var newDoc = parser.parseFromString(html, 'text/html');

      // タイトル更新
      document.title = newDoc.title;

      // meta description更新
      var oldMeta = document.querySelector('meta[name="description"]');
      var newMeta = newDoc.querySelector('meta[name="description"]');
      if(oldMeta && newMeta){
        oldMeta.setAttribute('content', newMeta.getAttribute('content'));
      }

      // canonical更新
      var oldCanonical = document.querySelector('link[rel="canonical"]');
      var newCanonical = newDoc.querySelector('link[rel="canonical"]');
      if(oldCanonical && newCanonical){
        oldCanonical.setAttribute('href', newCanonical.getAttribute('href'));
      }

      // 新しいbodyの内容を取得（音楽プレーヤー以外）
      var newBody = newDoc.body;

      // 音楽プレーヤーを保護
      var musicEl = document.getElementById('spa-music-player');
      var darkToggle = document.querySelector('.dark-mode-toggle');
      var spaLoader = document.getElementById('spa-loader');

      // 既存のbody子要素をクリア（保護要素以外）
      var children = Array.from(document.body.children);
      children.forEach(function(child){
        if(child.id === 'spa-music-player') return;
        if(child.id === 'spa-loader') return;
        if(child.id === 'ai-assistant-widget') return;
        if(child.id === 'ai-assistant-css') return;
        if(child.classList && child.classList.contains('dark-mode-toggle')) return;
        document.body.removeChild(child);
      });

      // 新しいbodyの子要素を追加（旧音楽プレーヤー、shared.jsのscriptは除く）
      var newChildren = Array.from(newBody.children);
      newChildren.forEach(function(child){
        // 旧来の音楽プレーヤー要素は追加しない
        if(child.id === 'musicToggle' || child.id === 'yt-player-container') return;
        if(child.id === 'spa-music-player') return;
        if(child.classList && child.classList.contains('music-toggle')) return;
        document.body.appendChild(document.importNode(child, true));
      });

      // 新しいページのインラインstyleをheadに追加
      var oldSpaStyles = document.querySelectorAll('style[data-spa]');
      oldSpaStyles.forEach(function(s){ s.remove(); });

      var newStyles = newDoc.querySelectorAll('head style, style');
      // headからのstyleのみ
      var headStyles = newDoc.head.querySelectorAll('style');
      headStyles.forEach(function(style){
        var s = document.createElement('style');
        s.setAttribute('data-spa', 'true');
        s.textContent = style.textContent;
        document.head.appendChild(s);
      });

      // bodyに書かれたインラインstyleも追加
      var bodyStyles = newBody.querySelectorAll('style');
      bodyStyles.forEach(function(style){
        var s = document.createElement('style');
        s.setAttribute('data-spa', 'true');
        s.textContent = style.textContent;
        document.head.appendChild(s);
      });

      // 新しいページのインラインscriptを実行
      var scripts = newBody.querySelectorAll('script');
      scripts.forEach(function(script){
        // shared.jsやYouTube APIはスキップ
        if(script.src && (script.src.indexOf('shared.js') !== -1 || script.src.indexOf('ai-assistant.js') !== -1 || script.src.indexOf('youtube') !== -1 || script.src.indexOf('gtag') !== -1)) return;
        var s = document.createElement('script');
        if(script.src){
          s.src = script.src;
        } else {
          // 旧来の音楽プレーヤーコードを除外
          var code = script.textContent;
          if(code.indexOf('onYouTubeIframeAPIReady') !== -1) {
            // 音楽プレーヤー初期化コードを除外し、それ以外を実行
            code = code.replace(/\(function\(\)\{[\s\S]*?var STORAGE_KEY='music_playing'[\s\S]*?\}\)\(\);/g, '');
          }
          if(code.trim()){
            s.textContent = code;
          } else {
            return;
          }
        }
        document.body.appendChild(s);
      });

      // URL更新
      if(pushState !== false){
        history.pushState({spaUrl: url}, '', url);
      }

      // 音楽プレーヤーがbody末尾にあるか確認し、なければ再追加
      if(musicEl && !document.body.contains(musicEl)){
        document.body.appendChild(musicEl);
      }

      // 共有JS機能の再初期化（ダークモード、読了時間、TOC、共有ボタン）
      initDarkMode();
      initReadingTime();
      initTOC();
      initShareButton();

      // スクロールトップへ
      window.scrollTo(0, 0);

      // ローダー完了
      loader.style.width = '100%';
      setTimeout(function(){
        loader.style.width = '0';
      }, 300);

      // Google Analyticsページビュー（gtag）
      if(window.gtag){
        gtag('config', 'G-VYPK32EB6B', {page_path: new URL(url, window.location.origin).pathname});
      }

      spaNavigating = false;
    })
    .catch(function(err){
      console.warn('SPA navigation failed, falling back:', err);
      loader.style.width = '0';
      spaNavigating = false;
      // フォールバック：通常のページ遷移
      window.location.href = url;
    });
}

function initSPANavigation(){
  if(!SPA_ENABLED) return;
  if(!window.history || !window.history.pushState) return;
  if(!window.fetch) return;

  // リンククリックをインターセプト
  document.addEventListener('click', function(e){
    // 最も近い<a>タグを取得
    var a = e.target.closest ? e.target.closest('a') : null;
    if(!a){
      // IE/Edge対策
      var el = e.target;
      while(el && el.tagName !== 'A') el = el.parentElement;
      a = el;
    }
    if(!a) return;
    if(!isSameOriginLink(a)) return;

    e.preventDefault();
    var url = a.href;

    // 現在と同じURLなら何もしない
    if(url === window.location.href) return;

    spaNavigate(url, true);
  });

  // ブラウザの戻る/進む対応
  window.addEventListener('popstate', function(e){
    var url = window.location.href;
    spaNavigate(url, false);
  });

  // 初回のstateをセット
  history.replaceState({spaUrl: window.location.href}, '', window.location.href);
}

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', function(){
  initDarkMode();
  initReadingTime();
  initTOC();
  initShareButton();
  initMusicPlayer();
  initSPANavigation();
});

})();
