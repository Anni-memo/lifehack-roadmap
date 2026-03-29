/* ══════════════════════════════════════════════
   書斎の案内人 — AIチャットアシスタント
   ルールベース + キーワードマッチング（API不要）
   ══════════════════════════════════════════════ */

(function(){
'use strict';

// ── 用語定義データ ──
var GLOSSARY_TERMS = {
  'PER': { def: '株価収益率（Price Earnings Ratio）。株価 / 1株利益で算出。低いほど割安とされるが、成長性との兼ね合いで判断する。', link: 'hajimete/per-pbr/' },
  'PBR': { def: '株価純資産倍率（Price Book-value Ratio）。株価 / 1株純資産で算出。1倍以下は解散価値割れ。', link: 'hajimete/per-pbr/' },
  'FCF': { def: 'フリーキャッシュフロー。営業CF - 設備投資で算出。企業が自由に使える現金で、真の稼ぐ力を表す。', link: 'fcf/' },
  'moat': { def: '経済的堀（モート）。企業が競合から自社を守る永続的な競争優位性。ネットワーク効果・スイッチングコスト・コスト優位・無形資産・ブランド力・規模の経済の6種類がある。', link: 'moat/' },
  'ROE': { def: '自己資本利益率（Return on Equity）。純利益 / 自己資本。株主資本をどれだけ効率よく使っているかを示す。', link: 'glossary/' },
  'ROA': { def: '総資産利益率（Return on Assets）。純利益 / 総資産。総資産に対する収益性を示す。', link: 'glossary/' },
  'EPS': { def: '1株当たり利益（Earnings Per Share）。純利益 / 発行済株式数。', link: 'glossary/' },
  'BPS': { def: '1株当たり純資産（Book-value Per Share）。純資産 / 発行済株式数。', link: 'glossary/' },
  '安全マージン': { def: '企業の内在価値と市場価格の差。グレアムが提唱し、分析の誤りや予期しない悪材料から投資家を守る緩衝材。', link: 'horizons/safety-margin/' },
  '複利': { def: '利益が利益を生む連鎖。アインシュタインが「人類最大の発明」と呼んだとされる。72の法則で倍になる年数を概算できる。', link: 'horizons/compound-interest/' },
  'ミスター・マーケット': { def: 'グレアムの寓話。市場は毎日気分で価格を提示してくる「躁鬱の相手」。振り回されず、自分の判断基準で行動することが重要。', link: 'principles/mr-market/' },
  '能力の輪': { def: 'バフェットの原則。自分が理解できるビジネスにだけ投資する。輪の大きさより、境界を知ることが重要。', link: 'principles/circle-of-competence/' },
  'メンタルモデル': { def: 'マンガーの思考法。多分野の知識を組み合わせた判断の枠組み。反転・複利・機会費用・インセンティブ・能力の輪が代表的。', link: 'horizons/mental-models/' },
  'SAVERS': { def: 'モーニングメソッドの6つの実践。Silence（静寂）・Affirmations（アファメーション）・Visualization（視覚化）・Exercise（運動）・Reading（読書）・Scribing（ジャーナリング）。', link: 'morning-method/' }
};

// ── キーワードマッチルール ──
var RULES = [
  // 記事推薦系
  {
    keywords: ['おすすめ', '何を読めば', '初心者', 'はじめて', '最初', '入門'],
    response: function(){ return 'はじめての方には「この書斎の歩き方」がおすすめです。投資の基本から一歩ずつ学べます。\n\n' + makeLink('この書斎の歩き方', 'hajimete/') + '\n' + makeLink('株式投資とは何か', 'hajimete/stock-basics/') + '\n' + makeLink('読書ルート', 'reading-routes/'); }
  },
  {
    keywords: ['モート', '堀', '競争優位', 'moat'],
    response: function(){ return 'moat（経済的堀）は長期投資で最も重要な概念です。6つの種類を解説しています。\n\n' + makeLink('moatをどう見るか', 'moat/') + '\n' + makeLink('ネットワーク効果', 'moat/network-effects/') + '\n' + makeLink('スイッチングコスト', 'moat/switching-costs/') + '\n' + makeLink('ブランド力の経済学', 'moat/brand-power/'); }
  },
  {
    keywords: ['バフェット', 'ウォーレン', 'buffett'],
    response: function(){ return 'バフェットの投資哲学に関する記事をご案内します。\n\n' + makeLink('能力の輪', 'principles/circle-of-competence/') + '\n' + makeLink('ミスター・マーケット', 'principles/mr-market/') + '\n' + makeLink('バリュー投資の本質', 'horizons/value-investing-essence/') + '\n' + makeLink('複利の力', 'horizons/compound-interest/'); }
  },
  {
    keywords: ['マンガー', 'チャーリー', 'munger'],
    response: function(){ return 'マンガーの思考法は投資を超えた人生の知恵です。\n\n' + makeLink('メンタルモデル入門', 'horizons/mental-models/') + '\n' + makeLink('行動経済学と投資判断', 'horizons/behavioral-economics/') + '\n' + makeLink('安全マージンの哲学', 'horizons/safety-margin/'); }
  },
  {
    keywords: ['グレアム', 'graham', 'ベンジャミン'],
    response: function(){ return 'グレアムはバリュー投資の父と呼ばれています。\n\n' + makeLink('バリュー投資の本質', 'horizons/value-investing-essence/') + '\n' + makeLink('ミスター・マーケット', 'principles/mr-market/') + '\n' + makeLink('安全マージンの哲学', 'horizons/safety-margin/'); }
  },
  {
    keywords: ['心理', 'バイアス', '行動経済学', '認知'],
    response: function(){ return '投資心理・認知バイアスに関する記事です。自分を知ることが最良の投資判断につながります。\n\n' + makeLink('FOMO', 'human/fomo/') + '\n' + makeLink('損失回避バイアス', 'human/loss-aversion/') + '\n' + makeLink('アンカリング効果', 'human/anchoring/') + '\n' + makeLink('確証バイアス', 'human/confirmation-bias/') + '\n' + makeLink('過信バイアス', 'human/overconfidence-bias/'); }
  },
  // 用語解説系
  {
    keywords: ['とは', '意味', '定義'],
    response: function(input){
      for(var term in GLOSSARY_TERMS){
        if(input.indexOf(term) !== -1 || input.indexOf(term.toLowerCase()) !== -1){
          var t = GLOSSARY_TERMS[term];
          return term + 'とは：' + t.def + '\n\n' + makeLink('詳しくはこちら', t.link);
        }
      }
      return '用語集で検索してみてください。50語以上の投資用語を定義しています。\n\n' + makeLink('用語集（グロッサリー）', 'glossary/');
    }
  },
  // 一日サポート系
  {
    keywords: ['朝', 'モーニング', '朝活', 'SAVERS'],
    response: function(){ return '朝の時間を最高の投資にしませんか？モーニングメソッドでは6つの実践（SAVERS）をインタラクティブに体験できます。\n\n' + makeLink('モーニングメソッド実践', 'morning-method/') + '\n' + makeLink('パーソナルホーム', 'smart-home/'); }
  },
  {
    keywords: ['瞑想', '音楽', '528', 'リラックス'],
    response: function(){ return '書斎では528Hzアンビエント音楽を再生できます。左下の音符ボタンをクリックしてください。静かな環境で読書や瞑想をお楽しみいただけます。\n\n' + makeLink('モーニングメソッド', 'morning-method/'); }
  },
  {
    keywords: ['振り返り', 'ジャーナル', '日記', '記録'],
    response: function(){ return '振り返りとジャーナリングは投資家にとって重要な習慣です。パーソナルホームの夜モードでジャーナリング機能をお使いいただけます。\n\n' + makeLink('パーソナルホーム', 'smart-home/') + '\n' + makeLink('モーニングメソッド', 'morning-method/'); }
  },
  // サイト案内系
  {
    keywords: ['このサイト', '何がある', '概要', 'サイト', '棚'],
    response: function(){ return 'この書斎には以下の棚があります：\n\n1. はじめの棚 - 投資の基本と歩き方\n2. 概念の棚 - moat・FCF・企業分析\n3. 業種から歩く棚 - 14業種の構造分析\n4. 思考を広げる棚 - 文明・哲学・歴史\n5. 人間理解の棚 - 認知バイアス・投資心理\n\nさらに用語集・読書ルート・モーニングメソッドもあります。\n\n' + makeLink('トップページ', './'); }
  },
  {
    keywords: ['検索', '探す', '見つける'],
    response: function(){ return 'トップページに検索機能があります。記事タイトル・用語・カテゴリーで検索できます。用語集でも50語以上を検索可能です。\n\n' + makeLink('トップページ', './') + '\n' + makeLink('用語集', 'glossary/'); }
  },
  // 学習系
  {
    keywords: ['クイズ', '問題', 'テスト', '学習', '算数', '計算'],
    response: function(){ return '「まなびの時間」で投資用語クイズ・算数チャレンジ・読解チャレンジに挑戦できます！\n\n' + makeLink('まなびの時間', 'learning/'); }
  },
  // 哲学系
  {
    keywords: ['哲学', 'ニーチェ', '禅', 'ストア', '思想'],
    response: function(){ return '投資と哲学は深くつながっています。\n\n' + makeLink('ニーチェと投資', 'horizons/nietzsche/') + '\n' + makeLink('禅と投資', 'horizons/zen/') + '\n' + makeLink('ストア哲学と投資', 'horizons/stoicism/'); }
  },
  // FCF系
  {
    keywords: ['キャッシュフロー', 'FCF', 'フリーキャッシュ'],
    response: function(){ return 'FCF（フリーキャッシュフロー）は企業の真の稼ぐ力を示す最も信頼できる指標です。\n\n' + makeLink('FCFとは何か', 'fcf/') + '\n' + makeLink('FCF入門', 'fcf/intro/'); }
  },
  // 業種系
  {
    keywords: ['業種', 'セクター', '業界'],
    response: function(){ return '14業種の構造・moat・FCF特性を分析しています。\n\n' + makeLink('業種から歩く棚', 'industries/') + '\n' + makeLink('日本株セクター別の特徴', 'industries/japan-sectors/'); }
  },
  // 複利系
  {
    keywords: ['複利', '72の法則', '長期投資', '積立'],
    response: function(){ return '複利は時間を味方にする最強の武器です。\n\n' + makeLink('複利の力', 'horizons/compound-interest/') + '\n' + makeLink('長期投資の数学', 'principles/long-term-math/'); }
  },
  // 挨拶系
  {
    keywords: ['こんにちは', 'hello', 'やあ', 'はじめまして', 'よろしく'],
    response: function(){ return 'こんにちは。書斎の案内人です。投資や記事について何でもお聞きください。おすすめの記事をご案内したり、用語を解説したりできます。'; }
  },
  {
    keywords: ['ありがとう', 'thanks', 'サンキュー'],
    response: function(){ return 'どういたしまして。また何かあればいつでもお声がけください。良い読書の時間をお過ごしください。'; }
  }
];

// ── ランダム記事3本（フォールバック用） ──
var FALLBACK_ARTICLES = [
  { title: 'この書斎の歩き方', url: 'hajimete/' },
  { title: 'moatをどう見るか', url: 'moat/' },
  { title: 'FCFとは何か', url: 'fcf/' },
  { title: '複利の力', url: 'horizons/compound-interest/' },
  { title: 'メンタルモデル入門', url: 'horizons/mental-models/' },
  { title: 'バリュー投資の本質', url: 'horizons/value-investing-essence/' },
  { title: 'ミスター・マーケット', url: 'principles/mr-market/' },
  { title: '能力の輪', url: 'principles/circle-of-competence/' },
  { title: 'ニーチェと投資', url: 'horizons/nietzsche/' },
  { title: '禅と投資', url: 'horizons/zen/' }
];

// ── ヘルパー ──
function getBaseHref(){
  var canonical = document.querySelector('link[rel="canonical"]');
  if(canonical){
    var href = canonical.getAttribute('href');
    var match = href.match(/(https?:\/\/[^\/]+\/[^\/]+\/)/);
    if(match) return match[1];
  }
  // パスから推測
  var path = window.location.pathname;
  var parts = path.split('/').filter(Boolean);
  if(parts.length > 0) return '/' + parts[0] + '/';
  return '/';
}

function makeLink(title, relUrl){
  var base = getBaseHref();
  return '<a href="' + base + relUrl + '" class="ai-chat-link">' + title + '</a>';
}

function getGreeting(){
  var h=new Date().getHours();
  var greetings;
  if(h>=4 && h<10){
    greetings=[
      'おはようございます。書斎の案内人です。\n今朝はどこから歩きますか。',
      'おはようございます。静かな朝ですね。\nどこへご案内しましょう。',
      'おはようございます。\n朝の実践から始めますか、それとも読書からですか。'
    ];
  }else if(h>=10 && h<17){
    greetings=[
      'こんにちは。書斎の案内人です。\nどこへご案内しましょうか。',
      'こんにちは。\n今日はどんなことに興味がありますか。',
      'こんにちは。\n急がなくて大丈夫です。入口を一つ選べば十分です。'
    ];
  }else{
    greetings=[
      'こんばんは。書斎の案内人です。\n夜の読書にいらっしゃいましたか。',
      'こんばんは。静かな夜ですね。\nゆっくり歩いていってください。',
      'こんばんは。\n今日一日の振り返りに、何か読みますか。'
    ];
  }
  return greetings[Math.floor(Math.random()*greetings.length)];
}

function getFollowup(){
  var followups=['他にもご案内できます。','まだお手伝いできることがあります。','他にも歩きたい場所はありますか。'];
  return followups[Math.floor(Math.random()*followups.length)];
}

function shuffleArray(arr){
  var a = arr.slice();
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function matchInput(input){
  var lower = input.toLowerCase();
  // 用語辞書から直接マッチ
  for(var term in GLOSSARY_TERMS){
    var termLower = term.toLowerCase();
    if(lower.indexOf(termLower + 'とは') !== -1 || lower === termLower + 'とは' || lower === termLower){
      var t = GLOSSARY_TERMS[term];
      return term + 'とは：' + t.def + '\n\n' + makeLink('詳しくはこちら', t.link);
    }
  }
  // ルールマッチ
  for(var i = 0; i < RULES.length; i++){
    var rule = RULES[i];
    for(var j = 0; j < rule.keywords.length; j++){
      if(lower.indexOf(rule.keywords[j].toLowerCase()) !== -1){
        return rule.response(lower);
      }
    }
  }
  // フォールバック
  var rand = shuffleArray(FALLBACK_ARTICLES).slice(0, 3);
  var links = rand.map(function(a){ return makeLink(a.title, a.url); }).join('\n');
  return '申し訳ございません。お探しの情報が見つかりませんでした。用語集で検索するか、こちらの記事をお試しください。\n\n' + makeLink('用語集', 'glossary/') + '\n' + links;
}

// ── UI構築 ──
function initAssistant(){
  if(document.getElementById('ai-assistant-widget')) return;

  var widget = document.createElement('div');
  widget.id = 'ai-assistant-widget';
  widget.innerHTML =
    '<button class="ai-fab" id="aiFab" title="書斎の案内人">' +
      '<svg class="ai-fab-icon" viewBox="0 0 64 64" width="34" height="34" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="32" cy="22" r="12" fill="#f5ede0"/>' +
        '<ellipse cx="32" cy="19" rx="8" ry="7" fill="#f5ede0"/>' +
        '<circle cx="28" cy="20" r="1.5" fill="#1a1208"/>' +
        '<circle cx="36" cy="20" r="1.5" fill="#1a1208"/>' +
        '<path d="M28 25 Q32 28 36 25" stroke="#1a1208" stroke-width="0.8" fill="none"/>' +
        '<path d="M24 27 Q28 32 32 28 Q36 32 40 27" stroke="#f5ede0" stroke-width="1.5" fill="none" opacity="0.9"/>' +
        '<path d="M22 28 Q20 32 22 34 L26 30 Z" fill="#f5ede0" opacity="0.7"/>' +
        '<path d="M42 28 Q44 32 42 34 L38 30 Z" fill="#f5ede0" opacity="0.7"/>' +
        '<rect x="22" y="8" rx="4" ry="2" width="20" height="14" fill="#1a1208" opacity="0.85"/>' +
        '<rect x="24" y="6" rx="2" ry="1" width="16" height="4" fill="#1a1208"/>' +
        '<rect x="24" y="32" width="16" height="22" rx="2" fill="#1a1208"/>' +
        '<rect x="28" y="32" width="8" height="10" rx="1" fill="#f5ede0" opacity="0.15"/>' +
        '<path d="M30 34 L30 40 M34 34 L34 40" stroke="#d4aa22" stroke-width="0.8"/>' +
        '<rect x="31" y="36" width="2" height="2" rx="1" fill="#d4aa22"/>' +
      '</svg>' +
      '<span class="ai-fab-label">書斎の案内人</span>' +
    '</button>' +
    '<div class="ai-chat-window" id="aiChatWindow">' +
      '<div class="ai-chat-header">' +
        '<span class="ai-chat-title">\uD83D\uDCDA 書斎の案内人</span>' +
        '<button class="ai-chat-close" id="aiChatClose">\u2715</button>' +
      '</div>' +
      '<div class="ai-chat-messages" id="aiChatMessages"></div>' +
      '<div class="ai-chat-input-wrap">' +
        '<input type="text" class="ai-chat-input" id="aiChatInput" placeholder="何かお探しですか？（例：おすすめ、PERとは）">' +
        '<button class="ai-chat-send" id="aiChatSend">送信</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(widget);

  // CSS挿入
  if(!document.getElementById('ai-assistant-css')){
    var style = document.createElement('style');
    style.id = 'ai-assistant-css';
    style.textContent = getAssistantCSS();
    document.head.appendChild(style);
  }

  // イベント
  var fab = document.getElementById('aiFab');
  var chatWindow = document.getElementById('aiChatWindow');
  var closeBtn = document.getElementById('aiChatClose');
  var input = document.getElementById('aiChatInput');
  var sendBtn = document.getElementById('aiChatSend');
  var messages = document.getElementById('aiChatMessages');

  fab.addEventListener('click', function(){
    chatWindow.classList.toggle('open');
    fab.classList.toggle('hidden');
    if(chatWindow.classList.contains('open')){
      // 初回：ツリーメニューを表示
      if(messages.children.length === 0){
        loadHistory();
        if(messages.children.length === 0){
          addBotMessage(getGreeting());
          showGuideTree('root');
        }
      }
    }
  });

  closeBtn.addEventListener('click', function(){
    chatWindow.classList.remove('open');
    fab.classList.remove('hidden');
  });

  sendBtn.addEventListener('click', function(){ sendMessage(); });
  input.addEventListener('keydown', function(e){
    if(e.key === 'Enter') sendMessage();
  });

  function sendMessage(){
    var text = input.value.trim();
    if(!text) return;
    addUserMessage(text);
    input.value = '';

    // タイピングアニメーション
    var typing = document.createElement('div');
    typing.className = 'ai-msg ai-msg-bot ai-typing';
    typing.innerHTML = '<span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    setTimeout(function(){
      if(typing.parentNode) typing.parentNode.removeChild(typing);
      var response = matchInput(text);
      addBotMessage(response);
      // 回答後にツリーを再表示
      addBotMessage(getFollowup());
      showGuideTree('root');
    }, 600 + Math.random() * 400);
  }

  // ── ツリーナビデータ ──
  var treeData={
    root:{items:[
      {label:'朝を整えたい',next:'morning'},
      {label:'投資を学びたい',next:'invest'},
      {label:'人物を読みたい',next:'people'},
      {label:'教養を深めたい',next:'culture'},
      {label:'企業を調べたい',next:'company'},
      {label:'用語を調べたい',next:'terms'},
    ]},
    morning:{msg:'朝の過ごし方を選んでください。',items:[
      {label:'3分で整える',url:'morning-practice/'},
      {label:'モーニングメソッドを学ぶ',url:'morning-method/'},
      {label:'夜の読書で休む',url:'night-reading/'},
      {label:'パーソナルホームを開く',url:'smart-home/'},
    ]},
    invest:{msg:'何から学びますか？',items:[
      {label:'初めての方へ',url:'hajimete/'},
      {label:'投資原則',url:'principles/'},
      {label:'moat（経済的堀）',url:'moat/'},
      {label:'FCF（キャッシュフロー）',url:'fcf/'},
      {label:'投資家の心理',url:'human/'},
      {label:'読書ルート',url:'reading-routes/'},
    ]},
    people:{msg:'誰を読みますか？',items:[
      {label:'人物録を開く',url:'people/'},
      {label:'田中渓',url:'people/tanaka-kei/'},
      {label:'BNF',url:'people/bnf/'},
      {label:'稲盛和夫',url:'people/inamori-kazuo/'},
      {label:'タレブ',url:'people/taleb/'},
      {label:'セネカ',url:'people/seneca/'},
      {label:'マルクス・アウレリウス',url:'life-shelf/marcus-aurelius/'},
      {label:'藤田晋',url:'life-shelf/fujita-susumu/'},
      {label:'落合陽一',url:'horizons/ochiai-yoichi/'},
    ]},
    culture:{msg:'どの方向へ深めますか？',items:[
      {label:'思考を広げる棚',url:'horizons/'},
      {label:'古典と人間理解',url:'classics/'},
      {label:'読む・聴く案内室',url:'book-guide/'},
      {label:'人生の書架',url:'life-shelf/'},
    ]},
    company:{msg:'どう調べますか？',items:[
      {label:'業種から歩く（14業種）',url:'industries/'},
      {label:'企業分析（69社）',url:'companies/'},
      {label:'銘柄メモ',url:'hajimete/memo/'},
      {label:'論考の棚',url:'research/'},
      {label:'ニュース記事',url:'news/'},
    ]},
    terms:{msg:'用語を入力するか、用語集を開いてください。',items:[
      {label:'用語集を開く',url:'glossary/'},
    ]},
  };

  function showGuideTree(key){
    var d=treeData[key];if(!d)return;
    var div=document.createElement('div');
    div.className='ai-msg ai-msg-bot ai-tree-menu';
    var html='';
    if(d.msg)html+='<div style="font-size:.75rem;color:#4a3520;margin-bottom:8px;">'+d.msg+'</div>';
    d.items.forEach(function(item){
      if(item.url){
        html+='<a href="'+getBaseHref()+item.url+'" class="ai-tree-btn">'+item.label+'</a>';
      }else if(item.next){
        html+='<div class="ai-tree-btn" onclick="window._guideTreeClick(\''+item.next+'\')">'+item.label+'</div>';
      }
    });
    if(key!=='root'){
      html+='<div class="ai-tree-back" onclick="window._guideTreeClick(\'root\')">\u2190 最初に戻る</div>';
    }
    // テキスト入力切替
    html+='<div class="ai-tree-switch" onclick="window._guideShowInput()">キーボードで入力する</div>';
    div.innerHTML=html;
    messages.appendChild(div);
    messages.scrollTop=messages.scrollHeight;
  }

  // グローバルに公開（onclick用）
  window._guideTreeClick=function(key){
    var d=treeData[key];
    if(d&&d.msg) addBotMessage(d.msg);
    else if(key==='root') addBotMessage('どこへご案内しましょうか？');
    showGuideTree(key);
  };
  window._guideShowInput=function(){
    var wrap=document.querySelector('.ai-chat-input-wrap');
    if(wrap)wrap.style.display='flex';
    input.focus();
  };

  function addUserMessage(text){
    var div = document.createElement('div');
    div.className = 'ai-msg ai-msg-user';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    saveHistory();
  }

  function addBotMessage(text){
    var div = document.createElement('div');
    div.className = 'ai-msg ai-msg-bot';
    // テキストをHTMLに変換（リンクを保持、改行をbrに）
    var html = text.replace(/\n/g, '<br>');
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    saveHistory();
  }

  function saveHistory(){
    try {
      var items = [];
      var msgs = messages.querySelectorAll('.ai-msg');
      msgs.forEach(function(m){
        items.push({
          type: m.classList.contains('ai-msg-user') ? 'user' : 'bot',
          html: m.innerHTML
        });
      });
      sessionStorage.setItem('ai_chat_history', JSON.stringify(items));
    } catch(e){}
  }

  function loadHistory(){
    try {
      var data = sessionStorage.getItem('ai_chat_history');
      if(!data) return;
      var items = JSON.parse(data);
      items.forEach(function(item){
        var div = document.createElement('div');
        div.className = 'ai-msg ' + (item.type === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
        div.innerHTML = item.html;
        messages.appendChild(div);
      });
      messages.scrollTop = messages.scrollHeight;
    } catch(e){}
  }
}

function getAssistantCSS(){
  return '' +
  '#ai-assistant-widget{position:fixed;bottom:72px;right:16px;z-index:9000;font-family:"Noto Serif JP","Cormorant Garamond",serif;}' +
  '.ai-fab{position:fixed;bottom:72px;right:16px;z-index:9001;padding:8px 14px;border-radius:24px;background:linear-gradient(135deg,#1a1208 0%,#2d2010 100%);border:1.5px solid rgba(184,144,10,.35);color:#d4aa22;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 24px rgba(26,18,8,.45),0 0 12px rgba(184,144,10,.08);transition:all .3s;}' +
  '.ai-fab:hover{background:linear-gradient(135deg,#2d2010 0%,#3a2a18 100%);border-color:#d4aa22;transform:translateY(-2px);box-shadow:0 6px 28px rgba(26,18,8,.5),0 0 16px rgba(184,144,10,.15);}' +
  '.ai-fab-icon{flex-shrink:0;}' +
  '.ai-fab-label{font-family:"Noto Serif JP",serif;font-size:.6rem;color:#d4aa22;letter-spacing:.06em;white-space:nowrap;opacity:.9;}' +
  '.ai-fab.hidden{opacity:0;pointer-events:none;transform:scale(0.5);}' +
  '.ai-chat-window{position:fixed;bottom:72px;right:16px;width:360px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 120px);background:#f5ede0;border:1px solid #dfc9a8;box-shadow:0 8px 48px rgba(26,18,8,.35);display:flex;flex-direction:column;opacity:0;pointer-events:none;transform:translateY(20px) scale(0.95);transition:all .3s;}' +
  '.ai-chat-window.open{opacity:1;pointer-events:all;transform:translateY(0) scale(1);}' +
  '.ai-chat-header{background:#1a1208;color:#f5ede0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #d4aa22;}' +
  '.ai-chat-title{font-size:.88rem;font-weight:600;letter-spacing:.04em;}' +
  '.ai-chat-close{background:none;border:none;color:#d4aa22;font-size:1.1rem;cursor:pointer;padding:4px 8px;transition:color .2s;}' +
  '.ai-chat-close:hover{color:#f0cc55;}' +
  '.ai-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}' +
  '.ai-msg{max-width:85%;padding:10px 14px;font-size:.8rem;line-height:1.7;border-radius:2px;word-break:break-word;}' +
  '.ai-msg-user{align-self:flex-end;background:#1a1208;color:#f5ede0;border-bottom-right-radius:0;}' +
  '.ai-msg-bot{align-self:flex-start;background:#efe4d0;color:#1a1208;border:1px solid #dfc9a8;border-bottom-left-radius:0;}' +
  '.ai-chat-link{display:inline-block;color:#8b6914;text-decoration:none;font-weight:600;padding:2px 0;border-bottom:1px solid rgba(139,105,20,.3);transition:all .2s;}' +
  '.ai-chat-link:hover{color:#b8900a;border-color:#b8900a;}' +
  '.ai-chat-input-wrap{display:none;border-top:1px solid #dfc9a8;background:#efe4d0;}' +
  '.ai-chat-input{flex:1;padding:12px 14px;border:none;background:transparent;font-family:inherit;font-size:.8rem;color:#1a1208;outline:none;}' +
  '.ai-chat-input::placeholder{color:#4a3520;opacity:.6;}' +
  '.ai-chat-send{padding:12px 18px;background:#1a1208;color:#d4aa22;border:none;cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:600;letter-spacing:.06em;transition:background .2s;}' +
  '.ai-chat-send:hover{background:#2d2010;}' +
  '.ai-typing{display:flex;gap:4px;padding:12px 16px;}' +
  '.ai-typing-dot{width:8px;height:8px;border-radius:50%;background:#b8900a;animation:ai-bounce .6s ease infinite;}' +
  '.ai-typing-dot:nth-child(2){animation-delay:.15s;}' +
  '.ai-typing-dot:nth-child(3){animation-delay:.3s;}' +
  '@keyframes ai-bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-6px);opacity:1}}' +
  /* ダークモード */
  '[data-theme="dark"] .ai-chat-window{background:#1a1208;border-color:#3a2a18;}' +
  '[data-theme="dark"] .ai-msg-bot{background:#221a0e;color:#e8dcc8;border-color:#3a2a18;}' +
  '[data-theme="dark"] .ai-chat-input-wrap{background:#221a0e;border-color:#3a2a18;}' +
  '[data-theme="dark"] .ai-chat-input{color:#e8dcc8;}' +
  '[data-theme="dark"] .ai-chat-input::placeholder{color:#b0a088;}' +
  '[data-theme="dark"] .ai-chat-link{color:#d4aa22;}' +
  '.ai-tree-menu{padding:8px !important;display:flex;flex-direction:column;gap:3px;}' +
  '.ai-tree-btn{display:block;padding:9px 12px;font-size:.76rem;color:#1a1208;background:#f5ede0;border:1px solid #dfc9a8;cursor:pointer;text-decoration:none;transition:all .15s;text-align:left;font-family:inherit;line-height:1.4;}' +
  '.ai-tree-btn:hover{border-color:#d4aa22;color:#8b6914;background:#efe4d0;}' +
  '.ai-tree-back{font-size:.62rem;color:#4a3520;cursor:pointer;padding:6px 8px;opacity:.6;transition:opacity .15s;text-align:center;margin-top:4px;}' +
  '.ai-tree-back:hover{opacity:1;color:#8b6914;}' +
  '.ai-tree-switch{font-size:.56rem;color:#8b6914;cursor:pointer;padding:4px 8px;opacity:.5;transition:opacity .15s;text-align:center;margin-top:2px;}' +
  '.ai-tree-switch:hover{opacity:1;}' +
  '[data-theme="dark"] .ai-tree-btn{background:#221a0e;color:#e8dcc8;border-color:#3a2a18;}' +
  '[data-theme="dark"] .ai-tree-btn:hover{border-color:#d4aa22;color:#d4aa22;}' +
  '[data-theme="dark"] .ai-tree-back{color:#b0a088;}' +
  '@media(max-width:420px){.ai-chat-window{width:calc(100vw - 16px);right:8px;bottom:64px;height:calc(100vh - 100px);}.ai-fab{right:12px;bottom:64px;}}';
}

// ── 初期化 ──
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initAssistant);
} else {
  initAssistant();
}

})();
