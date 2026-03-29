/* ══════════════════════════════════════════════
   投資と思考の書斎 — Presence（在室表示）
   Supabase Realtime で「今この書斎に何人いるか」を表示
   ══════════════════════════════════════════════ */

(function(){
'use strict';

var SUPABASE_URL = 'https://zwhmqwaalwhcedctwppm.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3aG1xd2FhbHdoY2VkY3R3cHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Nzc2NTksImV4cCI6MjA5MDM1MzY1OX0.qUG0EjLKaqbwPiNnSesIiTdI68St8ePDLxNv10UU3oU';

// ── 旅人ID（セッション単位） ──
var travelerId = sessionStorage.getItem('traveler_id');
if(!travelerId){
  travelerId = 'traveler_' + Math.random().toString(36).substr(2,9);
  sessionStorage.setItem('traveler_id', travelerId);
}

// ── 現在のページを取得 ──
function getCurrentShelf(){
  var path = window.location.pathname;
  if(path.indexOf('/people/') !== -1) return 'people';
  if(path.indexOf('/morning-method/') !== -1) return 'morning';
  if(path.indexOf('/morning-practice/') !== -1) return 'morning';
  if(path.indexOf('/companies/') !== -1) return 'companies';
  if(path.indexOf('/industries/') !== -1) return 'industries';
  if(path.indexOf('/horizons/') !== -1) return 'horizons';
  if(path.indexOf('/moat/') !== -1) return 'invest';
  if(path.indexOf('/fcf/') !== -1) return 'invest';
  if(path.indexOf('/principles/') !== -1) return 'invest';
  if(path.indexOf('/life-shelf/') !== -1) return 'culture';
  if(path.indexOf('/classics/') !== -1) return 'culture';
  if(path.indexOf('/news/') !== -1) return 'news';
  return 'lobby';
}

// ── Supabase Realtime Client (軽量版) ──
var ws = null;
var presenceState = {};
var channelRef = null;

function initPresence(){
  // WebSocket接続
  var wsUrl = SUPABASE_URL.replace('https://','wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_KEY + '&vsn=1.0.0';
  ws = new WebSocket(wsUrl);

  ws.onopen = function(){
    // heartbeat
    setInterval(function(){
      if(ws.readyState === 1) ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:null}));
    }, 30000);

    // チャンネルに参加
    var joinPayload = {
      topic: 'realtime:presence:library',
      event: 'phx_join',
      payload: {
        config: {
          presence: { key: travelerId }
        }
      },
      ref: '1'
    };
    ws.send(JSON.stringify(joinPayload));

    // Presence track
    setTimeout(function(){
      var trackPayload = {
        topic: 'realtime:presence:library',
        event: 'presence',
        payload: {
          type: 'presence',
          event: 'track',
          payload: {
            shelf: getCurrentShelf(),
            joined_at: new Date().toISOString()
          }
        },
        ref: '2'
      };
      ws.send(JSON.stringify(trackPayload));
    }, 1000);
  };

  ws.onmessage = function(e){
    try {
      var msg = JSON.parse(e.data);
      if(msg.event === 'presence_state'){
        presenceState = msg.payload || {};
        updatePresenceUI();
      }
      if(msg.event === 'presence_diff'){
        var joins = msg.payload.joins || {};
        var leaves = msg.payload.leaves || {};
        for(var k in joins) presenceState[k] = joins[k];
        for(var k in leaves) delete presenceState[k];
        updatePresenceUI();
      }
    }catch(err){}
  };

  ws.onclose = function(){
    // 再接続（5秒後）
    setTimeout(initPresence, 5000);
  };
}

// ── UI更新 ──
function updatePresenceUI(){
  var count = Object.keys(presenceState).length;
  var el = document.getElementById('presenceCount');
  if(el){
    if(count <= 1){
      el.textContent = '今この書斎にあなただけ';
    } else {
      el.textContent = '今この書斎に ' + count + '人';
    }
    el.style.opacity = '1';
  }
}

// ── Presence UIを各ページに挿入 ──
function insertPresenceUI(){
  // 既にあれば何もしない
  if(document.getElementById('presenceWidget')) return;

  var widget = document.createElement('div');
  widget.id = 'presenceWidget';
  widget.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:8000;font-family:"DM Mono",monospace;';

  widget.innerHTML =
    '<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(26,18,8,.85);border:1px solid rgba(184,144,10,.15);backdrop-filter:blur(8px);">' +
      '<div style="width:6px;height:6px;border-radius:50%;background:#5a9a78;animation:presencePulse 2s ease infinite;"></div>' +
      '<span id="presenceCount" style="font-size:.54rem;color:#dfc9a8;letter-spacing:.06em;opacity:0;transition:opacity .5s;">接続中...</span>' +
    '</div>';

  document.body.appendChild(widget);

  // パルスアニメーション
  if(!document.getElementById('presenceCSS')){
    var style = document.createElement('style');
    style.id = 'presenceCSS';
    style.textContent = '@keyframes presencePulse{0%,100%{opacity:.4}50%{opacity:1}}';
    document.head.appendChild(style);
  }
}

// ── 初期化 ──
function init(){
  insertPresenceUI();
  initPresence();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
