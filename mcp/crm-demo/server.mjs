#!/usr/bin/env node
/*
 * 大吉CRM — デモ用カスタムMCPサーバ（read-only）
 * --------------------------------------------------------------
 * - 依存パッケージなし。Node標準のみ（stdio上の JSON-RPC 2.0 を手書き実装）。
 * - 仕様は docs/claude-integration.md（カスタムMCP一択・X系 と SEC-X系）に準拠。
 * - データ源は環境変数で自動切替（§SUPABASE）: SUPABASE_URL＋読み取り専用キーがあれば
 *   Supabase の RPC（PostgREST）を叩き、無ければデモデータを返す。ツール名・入出力・
 *   操作方法・read-only は不変（UIとロジック共有＝C-6）。
 *
 * セキュリティ姿勢（デモでも順守）:
 *  - read-only：書き込みツールは一切持たない（SEC-X1）。
 *  - 最小権限：生SQLは受け付けない。決めたツールのみ（SEC-X2）。
 *  - PII最小化：email/電話は既定でマスク。reveal=true 指定時のみ復元（SEC-X4）。
 *  - 鍵は持たない（デモはローカルデータのみ。本番は鍵をサーバ側env/Secretsへ・SEC-X3）。
 */

// ====================== デモデータ（モック画面と整合） ======================
// 本番では下の COMPANIES を Supabase からの取得に置き換える（§SUPABASE）。
const COMPANIES = [
  { id:'c_daikichi', name:'株式会社 大吉商事', type:'法人', industry:'卸売', area:'東京都', size:'1億〜10億', status:'顧問中',
    needs:['集客','EC強化'], offers:['食材卸','配送代行'], owner:'山田 健太', notes:'紹介経由',
    contacts:[{ id:'p_sato', name:'佐藤 太郎', kana:'サトウ タロウ', title:'部長', department:'営業部', email:'sato@daikichi-shoji.co.jp', phone:'03-1234-5678', mobile:'090-1111-2222', is_primary:true,
                opt_in:true, topics:['税制改正ニュース','セミナー・勉強会案内'] }] },
  { id:'c_midori', name:'みどり食堂', type:'個人事業主', industry:'飲食', area:'大阪府', size:'〜1千万', status:'見込み',
    needs:['食材卸','集客'], offers:[], owner:'佐藤 京子', notes:'',
    contacts:[{ id:'p_midorikawa', name:'緑川 みどり', kana:'ミドリカワ ミドリ', title:'代表', department:'', email:'midori@midori-shokudo.jp', phone:'06-6543-2100', mobile:'080-3333-4444', is_primary:true,
                opt_in:true, topics:['セミナー・勉強会案内','経営お役立ち情報'] }] },
  { id:'c_satodesign', name:'佐藤デザイン事務所', type:'個人事業主', industry:'広告・メディア', area:'福岡県', size:'〜1千万', status:'顧問中',
    needs:['記帳代行'], offers:['Web広告','集客','ブランディング','EC強化'], owner:'山田 健太', notes:'',
    contacts:[{ id:'p_satohanako', name:'佐藤 花子', kana:'サトウ ハナコ', title:'代表', department:'', email:'hanako@sato-design.jp', phone:'092-100-2200', mobile:'080-5555-1212', is_primary:true,
                opt_in:true, topics:['経営お役立ち情報'] }] },
  { id:'c_suzuki', name:'鈴木工務店', type:'法人', industry:'建設', area:'愛知県', size:'5千万〜1億', status:'顧問中',
    needs:['集客','人材採用'], offers:['店舗内装'], owner:'田中 一郎', notes:'',
    contacts:[{ id:'p_suzuki', name:'鈴木 大輔', kana:'スズキ ダイスケ', title:'専務取締役', department:'', email:'suzuki@suzuki-koumuten.jp', phone:'052-700-3300', mobile:'090-7777-8888', is_primary:true,
                opt_in:false, topics:['年末調整のお知らせ'] }] },
  { id:'c_tech', name:'テック合同会社', type:'法人', industry:'IT・情報通信', area:'東京都', size:'1千万〜5千万', status:'顧問中',
    needs:['販路拡大','人材採用'], offers:['システム開発','EC強化'], owner:'山田 健太', notes:'',
    contacts:[{ id:'p_tanaka', name:'田中 啓介', kana:'タナカ ケイスケ', title:'CTO', department:'技術部', email:'tanaka@tech-llc.jp', phone:'03-4000-5500', mobile:'080-1212-3434', is_primary:true,
                opt_in:true, topics:['税制改正ニュース','経営お役立ち情報'] }] },
  { id:'c_hokuto', name:'株式会社 北斗ロジ', type:'法人', industry:'運輸・物流', area:'北海道', size:'1億〜10億', status:'顧問中',
    needs:['資金調達'], offers:['配送代行'], owner:'佐藤 京子', notes:'',
    contacts:[{ id:'p_kitano', name:'北野 進', kana:'キタノ ススム', title:'物流部長', department:'物流部', email:'kitano@hokuto-logi.jp', phone:'011-300-9900', mobile:'090-2222-3333', is_primary:true,
                opt_in:true, topics:['決算前リマインド'] }] },
  { id:'c_yamamoto', name:'山本会計サポート', type:'個人事業主', industry:'専門サービス', area:'東京都', size:'不明', status:'休眠',
    needs:[], offers:['記帳代行'], owner:'田中 一郎', notes:'',
    contacts:[{ id:'p_yamamoto', name:'山本 浩', kana:'ヤマモト ヒロシ', title:'代表', department:'', email:'yamamoto@yamamoto-as.jp', phone:'03-8800-1100', mobile:'080-4444-5555', is_primary:true,
                opt_in:false, topics:[] }] },
  { id:'c_himawari', name:'カフェ・ひだまり', type:'個人事業主', industry:'飲食', area:'京都府', size:'〜1千万', status:'見込み',
    needs:['集客','資金調達'], offers:[], owner:'佐藤 京子', notes:'',
    contacts:[{ id:'p_hinata', name:'日向 葵', kana:'ヒナタ アオイ', title:'店主', department:'', email:'aoi@hidamari-cafe.jp', phone:'075-555-6677', mobile:'080-6666-7777', is_primary:true,
                opt_in:true, topics:['セミナー・勉強会案内'] }] },
  { id:'c_umikaze', name:'合同会社 海風マリン', type:'法人', industry:'卸売', area:'福岡県', size:'1千万〜5千万', status:'見込み',
    needs:['販路拡大','EC強化'], offers:['海産物卸'], owner:'佐藤 京子', notes:'',
    contacts:[{ id:'p_oshima', name:'大島 涼', kana:'オオシマ リョウ', title:'課長', department:'仕入課', email:'oshima@umikaze.jp', phone:'092-300-7700', mobile:'080-9999-0000', is_primary:false,
                opt_in:false, topics:[] }] },
  { id:'c_sakura', name:'さくら美容室', type:'法人', industry:'美容・理容', area:'京都府', size:'〜1千万', status:'見込み',
    needs:['集客'], offers:[], owner:'山田 健太', notes:'',
    contacts:[{ id:'p_takahashi', name:'高橋 結衣', kana:'タカハシ ユイ', title:'店長', department:'', email:'yui@sakura-bes.jp', phone:'075-222-1188', mobile:'090-5555-6666', is_primary:true,
                opt_in:true, topics:['セミナー・勉強会案内','経営お役立ち情報'] }] },
];

// 企業ごとの保管資料（メタデータのみ。実体は非公開バケット＝SEC-12。本番は company_documents テーブル/RPCへ）
const DOCUMENTS = [
  // 株式会社 大吉商事（企業詳細モックと整合）
  { company_id:'c_daikichi',   file_name:'御見積書_EC構築_2026.pdf',                 category:'提案資料',          size_kb:480,  created_at:'2026-06-12', uploaded_by:'山田 健太' },
  { company_id:'c_daikichi',   file_name:'商品カタログ_業務用パッケージ_2026春.pdf', category:'商品・サービス資料', size_kb:3277, created_at:'2026-06-01', uploaded_by:'佐藤 京子' },
  { company_id:'c_daikichi',   file_name:'会社案内_パンフ.jpg',                       category:'商品・サービス資料', size_kb:1126, created_at:'2026-05-20', uploaded_by:'佐藤 京子' },
  { company_id:'c_daikichi',   file_name:'決算書_2025年3月期.xlsx',                   category:'決算書',            size_kb:220,  created_at:'2025-11-05', uploaded_by:'田中 一郎' },
  { company_id:'c_daikichi',   file_name:'顧問契約書_締結済.pdf',                     category:'契約書',            size_kb:640,  created_at:'2025-11-02', uploaded_by:'山田 健太' },
  { company_id:'c_daikichi',   file_name:'業務フロー説明資料.docx',                   category:'その他',            size_kb:95,   created_at:'2026-04-10', uploaded_by:'田中 一郎' },
  // テック合同会社
  { company_id:'c_tech',       file_name:'システム開発_提案書_v2.pdf',               category:'提案資料',          size_kb:780,  created_at:'2026-06-10', uploaded_by:'山田 健太' },
  { company_id:'c_tech',       file_name:'サービス紹介資料_SaaS.pdf',                 category:'商品・サービス資料', size_kb:1433, created_at:'2026-05-15', uploaded_by:'田中 一郎' },
  // 佐藤デザイン事務所
  { company_id:'c_satodesign', file_name:'ポートフォリオ_2026.pdf',                   category:'商品・サービス資料', size_kb:5734, created_at:'2026-03-30', uploaded_by:'山田 健太' },
  { company_id:'c_satodesign', file_name:'Web広告_提案資料.pdf',                      category:'提案資料',          size_kb:900,  created_at:'2026-06-08', uploaded_by:'山田 健太' },
  // 株式会社 北斗ロジ
  { company_id:'c_hokuto',     file_name:'配送サービス料金表_2026.pdf',               category:'商品・サービス資料', size_kb:350,  created_at:'2026-04-22', uploaded_by:'佐藤 京子' },
  { company_id:'c_hokuto',     file_name:'顧問契約書.pdf',                            category:'契約書',            size_kb:610,  created_at:'2025-09-01', uploaded_by:'佐藤 京子' },
  // 合同会社 海風マリン
  { company_id:'c_umikaze',    file_name:'商品カタログ_海産物_2026.pdf',              category:'商品・サービス資料', size_kb:2867, created_at:'2026-06-18', uploaded_by:'佐藤 京子' },
  { company_id:'c_umikaze',    file_name:'決算書_2025年4月期.xlsx',                   category:'決算書',            size_kb:240,  created_at:'2026-06-15', uploaded_by:'佐藤 京子' },
  // 鈴木工務店
  { company_id:'c_suzuki',     file_name:'施工事例集.pdf',                            category:'商品・サービス資料', size_kb:4198, created_at:'2026-02-10', uploaded_by:'田中 一郎' },
  { company_id:'c_suzuki',     file_name:'顧問契約書.pdf',                            category:'契約書',            size_kb:600,  created_at:'2025-08-01', uploaded_by:'田中 一郎' },
  // みどり食堂
  { company_id:'c_midori',     file_name:'メニュー表.pdf',                            category:'その他',            size_kb:300,  created_at:'2026-05-01', uploaded_by:'佐藤 京子' },
  // さくら美容室
  { company_id:'c_sakura',     file_name:'サービスメニュー_料金表.pdf',               category:'商品・サービス資料', size_kb:420,  created_at:'2026-06-05', uploaded_by:'山田 健太' },
];

// 活動履歴（タイムライン）。要約＋参照のみ保持（実体は元レコード＋署名URL側＝SEC-13）。本番は activities テーブル/RPCへ。
// occurred_at は "YYYY-MM-DD HH:MM"（文字列の降順＝新しい順）。company_id:null は全社向け活動（特定企業のタイムラインには出さない）。
const ACTIVITIES = [
  // 6/23（今日）
  { id:'a_01', company_id:'c_umikaze',                        kind:'タスク',     title:'法人税・消費税 申告書ドラフトを作成完了（レビュー待ち）', source:'自動', source_kind:'schedule',   source_id:'sch_umikaze_kessan',      status:'対応中', actor:'佐藤 京子', occurred_at:'2026-06-23 14:00' },
  { id:'a_02', company_id:'c_tech',     contact_id:'p_tanaka',  kind:'議事録',    title:'「6月度 定例MTG」を Notta から取込・要約（次アクション3件抽出）', source:'自動', source_kind:'note',       source_id:'note_tech_0623',          actor:'田中 一郎', occurred_at:'2026-06-23 11:15' },
  { id:'a_03', company_id:'c_midori',   contact_id:'p_midorikawa', kind:'電話',   title:'初回提案のフォロー。来週の対面打ち合わせで合意',           source:'手動', actor:'佐藤 京子', occurred_at:'2026-06-23 09:40' },
  // 6/22
  { id:'a_04', company_id:'c_suzuki',   contact_id:'p_suzuki',  kind:'面談・訪問', title:'現場訪問。採用の相談あり → needs に「人材採用」を追加',   source:'手動', actor:'田中 一郎', occurred_at:'2026-06-22 16:30' },
  { id:'a_05', company_id:'c_satodesign',                       kind:'メール',     title:'5月分の記帳資料の受領を確認し返信',                       source:'手動', actor:'山田 健太', occurred_at:'2026-06-22 10:05' },
  // 6/20
  { id:'a_06', company_id:'c_daikichi',                         kind:'紹介',       title:'協業先紹介を打診（集客 / EC強化）→ 佐藤デザイン事務所。打診中', source:'自動', source_kind:'referral',   source_id:'ref_daikichi_satodesign', status:'対応中', actor:'山田 健太', occurred_at:'2026-06-20 15:20' },
  { id:'a_07', company_id:null,                                 kind:'メルマガ',   title:'配信「税制改正ニュース 6月号」対象38名（成功36 / 停止スキップ2）', source:'自動', source_kind:'newsletter', source_id:'nl_202606',               actor:'山田 健太', occurred_at:'2026-06-20 09:00' },
  // 6/19
  { id:'a_08', company_id:'c_himawari',                         kind:'フォーム',   title:'公開フォームから新規問い合わせを受信（未取込）',           source:'自動', source_kind:'form',       source_id:'form_himawari_0619',      status:'未対応', actor:'システム', occurred_at:'2026-06-19 17:45' },
  { id:'a_09', company_id:'c_hokuto',   contact_id:'p_kitano',  kind:'名刺',       title:'北野さんの名刺を OCR 取込し担当者に登録',                 source:'自動', source_kind:'card',       source_id:'card_kitano',             actor:'佐藤 京子', occurred_at:'2026-06-19 13:10' },
  // 大吉商事のタイムラインを厚めに（デモ）
  { id:'a_10', company_id:'c_daikichi', contact_id:'p_sato',   kind:'メール',      title:'御見積書（EC構築）送付の連絡',                           source:'手動', actor:'山田 健太', occurred_at:'2026-06-18 13:30' },
  { id:'a_11', company_id:'c_daikichi',                         kind:'タスク',     title:'試算表の確認・送付',                                     source:'手動', status:'完了', actor:'山田 健太', occurred_at:'2026-06-15 17:00' },
  { id:'a_12', company_id:'c_daikichi',                         kind:'資料',       title:'御見積書_EC構築_2026.pdf をアップロード',                source:'自動', source_kind:'document',   source_id:'御見積書_EC構築_2026.pdf', actor:'山田 健太', occurred_at:'2026-06-12 10:20' },
  { id:'a_13', company_id:'c_tech',     contact_id:'p_tanaka',  kind:'電話',       title:'開発スケジュールの確認',                                 source:'手動', actor:'田中 一郎', occurred_at:'2026-06-16 15:30' },
];

const MASTERS = {
  industries: ['農林漁業','建設','製造','卸売','小売','飲食','宿泊・観光','運輸・物流','IT・情報通信','不動産','金融・保険','専門サービス','医療・福祉','教育・学習支援','美容・理容','生活関連サービス','広告・メディア','その他'],
  areas: { '北海道・東北':['北海道','青森','岩手','宮城','秋田','山形','福島'], '関東':['茨城','栃木','群馬','埼玉','千葉','東京都','神奈川'], '中部':['新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知'], '近畿':['三重','滋賀','京都','大阪','兵庫','奈良','和歌山'], '中国・四国':['鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知'], '九州・沖縄':['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'] },
  sizes: ['〜1千万','1千万〜5千万','5千万〜1億','1億〜10億','10億〜','不明'],
  newsletter_topics: ['税制改正ニュース','セミナー・勉強会案内','経営お役立ち情報','年末調整のお知らせ','決算前リマインド'],
  document_categories: ['契約書','決算書','商品・サービス資料','提案資料','その他'],
};

// ====================== ユーティリティ ======================
function maskEmail(e){ if(!e) return e; const [u,d='***']=e.split('@'); return (u.slice(0,1)||'')+'***@'+d; }
function maskPhone(p){ if(!p) return p; return p.replace(/\d/g, (d,i)=> (i<3 || i>=p.length-2) ? d : '*'); }
function overlap(a=[], b=[]){ const s=new Set(b); return a.filter(x=>s.has(x)); }
function fmtSize(kb){ return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`; }
const allContacts = () => COMPANIES.flatMap(c => c.contacts.map(ct => ({ ...ct, company_id:c.id, company:c.name, industry:c.industry, area:c.area, status:c.status })));

function companyPublic(c){ return { id:c.id, name:c.name, type:c.type, industry:c.industry, area:c.area, size:c.size, status:c.status, needs:c.needs, offers:c.offers, owner:c.owner }; }
function contactView(ct, reveal){ return { id:ct.id, name:ct.name, kana:ct.kana, title:ct.title, department:ct.department, is_primary:ct.is_primary,
  email: reveal ? ct.email : maskEmail(ct.email), phone: reveal ? ct.phone : maskPhone(ct.phone), mobile: reveal ? ct.mobile : maskPhone(ct.mobile) }; }

// 企業を ID / 社名で解決。完全一致(ID→社名)→部分一致(社名includes)の順。検索系ツール(includes)と挙動を統一。
// 部分一致が複数なら候補を返して曖昧さを明示する（呼び出し側は error として扱う）。
function resolveCompany(q){
  const s = (q==null ? '' : String(q)).trim();
  if(!s) return { error:'company_id（企業ID or 社名）を指定してください' };
  let c = COMPANIES.find(x=> x.id===s || x.name===s);   // 1) ID/社名の完全一致
  if(c) return { company:c };
  const hits = COMPANIES.filter(x=> x.name.includes(s)); // 2) 社名の部分一致
  if(hits.length===1) return { company:hits[0] };
  if(hits.length>1)  return { error:`企業名が複数該当します: ${s}`, candidates: hits.map(x=>({ id:x.id, name:x.name })) };
  return { error:`企業が見つかりません: ${s}` };
}

// ====================== ツール本体（§SUPABASE: 本番はRPC呼び出しに置換） ======================
function t_search_companies(a={}){
  let rows = COMPANIES.slice();
  if(a.type) rows = rows.filter(c=>c.type===a.type);
  if(a.industry) rows = rows.filter(c=>c.industry===a.industry);
  if(a.area) rows = rows.filter(c=>c.area===a.area);
  if(a.status) rows = rows.filter(c=>c.status===a.status);
  if(a.needs) rows = rows.filter(c=>c.needs.includes(a.needs));
  if(a.offers) rows = rows.filter(c=>c.offers.includes(a.offers));
  if(a.keyword){ const k=a.keyword; rows = rows.filter(c=> (c.name+ ' '+(c.notes||'')).includes(k)); }
  const limit = Math.min(a.limit||20, 100);
  return { count: rows.length, companies: rows.slice(0, limit).map(companyPublic) };
}
function t_get_company(a={}){
  const r = resolveCompany(a.company_id);
  if(r.error) return r;
  const c = r.company;
  return { ...companyPublic(c), notes:c.notes, contacts: c.contacts.map(ct=>contactView(ct, !!a.reveal_contact_info)) };
}
function t_list_contacts(a={}){
  let rows = allContacts();
  if(a.company) rows = rows.filter(r=> r.company.includes(a.company));
  if(a.primary_only) rows = rows.filter(r=> r.is_primary);
  if(a.keyword){ const k=a.keyword; rows = rows.filter(r=> (r.name+r.kana+r.company).includes(k)); }
  const limit = Math.min(a.limit||50, 200);
  return { count: rows.length, contacts: rows.slice(0,limit).map(r=> ({ ...contactView(r, !!a.reveal_contact_info), company:r.company, company_id:r.company_id, status:r.status })) };
}
function t_find_matches(a={}){
  const r = resolveCompany(a.company_id);
  if(r.error) return r;
  const A = r.company;
  const limit = Math.min(a.limit||10, 50);
  const out = [];
  for(const B of COMPANIES){
    if(B.id===A.id) continue;
    const collab = overlap(A.needs, B.offers);   // 協業先紹介: AのneedsをBのoffersが満たす
    const refer  = overlap(A.offers, B.needs);    // 顧客紹介: AのoffersをBのneedsが必要としている
    const score = collab.length + refer.length;
    if(score>0) out.push({ company_id:B.id, company:B.name, industry:B.industry, area:B.area, status:B.status, score,
      kyogyo_tags: collab, kokyaku_tags: refer,
      reason: [collab.length?`協業先紹介: ${A.name} の needs「${collab.join('・')}」を ${B.name} が提供`:null,
               refer.length ?`顧客紹介: ${A.name} の offers「${refer.join('・')}」を ${B.name} が必要`:null].filter(Boolean) });
  }
  out.sort((x,y)=> y.score-x.score);
  return { base: A.name, formula:'score = |needs∩相手offers| + |offers∩相手needs|（FR-M3）', matches: out.slice(0,limit) };
}
function t_suggest_matches(a={}){
  const limit = Math.min(a.limit||10, 50);
  const pairs = [];
  for(let i=0;i<COMPANIES.length;i++) for(let j=i+1;j<COMPANIES.length;j++){
    const A=COMPANIES[i], B=COMPANIES[j];
    const ab = overlap(A.needs,B.offers), ba = overlap(A.offers,B.needs);
    const score = ab.length+ba.length;
    if(score>0) pairs.push({ a:A.name, b:B.name, score, matched_tags:[...new Set([...ab,...ba])] });
  }
  pairs.sort((x,y)=>y.score-x.score);
  return { count: pairs.length, top: pairs.slice(0,limit) };
}
function t_list_tags(){
  const map = {};
  for(const c of COMPANIES){ for(const n of c.needs){ (map[n]??={need:0,offer:0}).need++; } for(const o of c.offers){ (map[o]??={need:0,offer:0}).offer++; } }
  const tags = Object.entries(map).map(([label,v])=>({ label, used_in_needs:v.need, used_in_offers:v.offer })).sort((a,b)=> (b.used_in_needs+b.used_in_offers)-(a.used_in_needs+a.used_in_offers));
  return { count: tags.length, tags };
}
function t_get_masters(){ return MASTERS; }
function t_get_newsletter_segment(a={}){
  const topics = a.topic_ids || a.topics || [];
  let rows = allContacts().filter(r=> r.opt_in);                 // 配信同意ありのみ（SEC/法令）
  if(topics.length) rows = rows.filter(r=> (r.topics||[]).some(t=> topics.includes(t)));
  if(a.status) rows = rows.filter(r=> r.status===a.status);
  if(a.industry) rows = rows.filter(r=> r.industry===a.industry);
  if(a.area) rows = rows.filter(r=> r.area===a.area);
  return { topic_ids: topics, count: rows.length,
    note:'同意なし・配信停止は自動除外（本文の下書きはClaudeが作成・ツールはLLMを呼ばない＝FR-N12/FR-X3）',
    sample: rows.slice(0,8).map(r=> ({ name:r.name, company:r.company, email: maskEmail(r.email) })) };
}
function t_search_documents(a={}){
  // 全社横断のメタデータ検索（FR-F10）。ファイル本体・署名URLは返さない（SEC-12）。閲覧/DLはUI側で署名URL発行。
  let rows = DOCUMENTS.map(d => { const c = COMPANIES.find(x=>x.id===d.company_id); return { ...d, company: c ? c.name : d.company_id }; });
  if(a.company){ const q=a.company; rows = rows.filter(r=> r.company.includes(q) || r.company_id===q); }
  if(a.category) rows = rows.filter(r=> r.category===a.category);
  if(a.keyword){ const k=a.keyword; rows = rows.filter(r=> (r.file_name+' '+r.category+' '+r.company).includes(k)); }
  rows.sort((x,y)=> x.created_at < y.created_at ? 1 : -1);   // 登録の新しい順
  const limit = Math.min(a.limit||50, 200);
  const total_kb = rows.reduce((s,r)=> s + r.size_kb, 0);
  return { count: rows.length, total_size: fmtSize(total_kb),
    note: 'メタデータのみ返却（ファイル本体・署名URLは返さない＝SEC-12）。閲覧/DLはUI側で有効期限つき署名URLを発行。',
    documents: rows.slice(0,limit).map(r=> ({ company:r.company, company_id:r.company_id, file_name:r.file_name, category:r.category, size:fmtSize(r.size_kb), uploaded_by:r.uploaded_by, created_at:r.created_at })) };
}
function t_get_company_timeline(a={}){
  // FR-AC10: 企業の活動履歴（タイムライン）を新しい順で返す（read-only）。
  // 要約＋参照のみ（議事録全文・名刺・資料の実体は元レコード＋署名URL側＝SEC-13/SEC-X4）。
  const r = resolveCompany(a.company_id);
  if(r.error) return r;                                  // 部分一致が複数なら candidates を返す（他ツールと統一）
  const c = r.company;
  const nameOf = id => { for(const co of COMPANIES){ const ct=co.contacts.find(p=>p.id===id); if(ct) return ct.name; } return undefined; };
  let rows = ACTIVITIES.filter(e=> e.company_id===c.id);  // 全社向け(company_id:null)は特定企業のタイムラインに出さない
  if(a.kind)   rows = rows.filter(e=> e.kind===a.kind);
  if(a.source) rows = rows.filter(e=> e.source===a.source);
  rows.sort((x,y)=> x.occurred_at < y.occurred_at ? 1 : -1);   // occurred_at の新しい順
  const limit = Math.min(a.limit||30, 100);
  return { company: c.name, count: rows.length,
    note: '活動の要約のみ返却（議事録全文・名刺・資料の実体は元レコード＋署名URL側＝SEC-13/SEC-X4）。連絡先は返さない。',
    timeline: rows.slice(0,limit).map(e=> ({ when:e.occurred_at, kind:e.kind, title:e.title,
      status:e.status, contact: e.contact_id ? nameOf(e.contact_id) : undefined,
      actor:e.actor, source:e.source, source_kind:e.source_kind, source_id:e.source_id })) };
}

// ====================== ツール定義（Claudeへ見せるスキーマ） ======================
const TOOLS = [
  { name:'search_companies', description:'顧客（企業）を条件で検索して一覧を返す（read-only）。UIの絞り込みと同一ロジック。',
    inputSchema:{ type:'object', properties:{ type:{type:'string',enum:['法人','個人事業主']}, industry:{type:'string'}, area:{type:'string'}, status:{type:'string',enum:['顧問中','見込み','休眠']}, needs:{type:'string',description:'求めてるタグ1つ'}, offers:{type:'string',description:'提供できるタグ1つ'}, keyword:{type:'string'}, limit:{type:'number'} } } },
  { name:'get_company', description:'企業の詳細＋担当者要約を返す（read-only）。連絡先は既定でマスク。',
    inputSchema:{ type:'object', properties:{ company_id:{type:'string',description:'企業ID or 社名'}, reveal_contact_info:{type:'boolean',description:'true で email/電話 を復元（PII）'} }, required:['company_id'] } },
  { name:'list_contacts', description:'「会った人」（担当者）を会社横断で一覧（read-only）。連絡先は既定でマスク。',
    inputSchema:{ type:'object', properties:{ keyword:{type:'string'}, company:{type:'string'}, primary_only:{type:'boolean'}, reveal_contact_info:{type:'boolean'}, limit:{type:'number'} } } },
  { name:'find_matches', description:'起点企業に対する紹介候補をスコア順で返す（read-only / FR-M）。',
    inputSchema:{ type:'object', properties:{ company_id:{type:'string',description:'起点の企業ID or 社名'}, limit:{type:'number'} }, required:['company_id'] } },
  { name:'suggest_matches', description:'起点指定なしの「おすすめ紹介」組み合わせをスコア順で返す（read-only）。',
    inputSchema:{ type:'object', properties:{ limit:{type:'number'} } } },
  { name:'list_tags', description:'求/提の共通タグ語彙と使用件数を返す（read-only）。', inputSchema:{ type:'object', properties:{} } },
  { name:'get_masters', description:'業種・エリア（地方区分）・規模・メルマガ属性のマスタを返す（read-only）。', inputSchema:{ type:'object', properties:{} } },
  { name:'get_newsletter_segment', description:'メルマガ配信トピック×顧客属性での対象人数とサンプルを返す（read-only）。本文はClaudeが作成。',
    inputSchema:{ type:'object', properties:{ topic_ids:{type:'array',items:{type:'string'}}, status:{type:'string'}, industry:{type:'string'}, area:{type:'string'} } } },
  { name:'search_documents', description:'企業の保管資料を全社横断でメタデータ検索（read-only / FR-F10）。ファイル本体・署名URLは返さない（SEC-12）。閲覧/DLはUI側で署名URL発行。',
    inputSchema:{ type:'object', properties:{ keyword:{type:'string',description:'ファイル名・カテゴリ・社名の部分一致'}, category:{type:'string',enum:['契約書','決算書','商品・サービス資料','提案資料','その他']}, company:{type:'string',description:'社名 or 企業ID'}, limit:{type:'number'} } } },
  { name:'get_company_timeline', description:'企業の活動履歴（タイムライン）を新しい順で返す（read-only / FR-AC10）。要約のみ＝議事録全文・名刺・資料の実体や連絡先は返さない（SEC-13/SEC-X4）。',
    inputSchema:{ type:'object', properties:{ company_id:{type:'string',description:'企業ID or 社名'}, kind:{type:'string',enum:['電話','面談・訪問','メール','議事録','紹介','メルマガ','フォーム','名刺','資料','タスク','メモ'],description:'活動種別で絞り込み（任意）'}, source:{type:'string',enum:['自動','手動'],description:'記録方法で絞り込み（任意）'}, limit:{type:'number'} }, required:['company_id'] } },
];
const HANDLERS = { search_companies:t_search_companies, get_company:t_get_company, list_contacts:t_list_contacts, find_matches:t_find_matches, suggest_matches:t_suggest_matches, list_tags:t_list_tags, get_masters:t_get_masters, get_newsletter_segment:t_get_newsletter_segment, search_documents:t_search_documents, get_company_timeline:t_get_company_timeline };

// ====================== §SUPABASE 本番データ源（PostgREST RPC・任意） ======================
// 環境変数が設定されていれば、各ツールのデータ源を Supabase の RPC 呼び出しへ差し替える。
// ツール名・入出力・read-only は不変（UIとロジック共有＝C-6）。未設定ならデモデータのまま。
// 鍵は「読み取り専用ロール＋ホワイトリストRPCの EXECUTE」を想定（service_role は使わない＝SEC-X3/X6）。
const SUPA_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPA_KEY = process.env.SUPABASE_MCP_KEY || process.env.SUPABASE_READONLY_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const LIVE = !!(SUPA_URL && SUPA_KEY);

// PostgREST の RPC を叩く（POST /rest/v1/rpc/<fn>）。返り値は関数の jsonb をそのまま。
async function callRpc(fn, params){
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method:'POST',
    headers:{ 'apikey':SUPA_KEY, 'Authorization':`Bearer ${SUPA_KEY}`, 'Content-Type':'application/json', 'Accept':'application/json' },
    body: JSON.stringify(params || {}),
  });
  if(!res.ok){ const txt = await res.text().catch(()=> ''); throw new Error(`RPC ${fn} HTTP ${res.status}: ${txt.slice(0,300)}`); }
  return res.json();
}

// MCPツール引数 → RPC名＋パラメータ名（SQL関数の引数名）へのマッピング。出力はRPCと同一形（デモと整合）。
const LIVE_HANDLERS = {
  search_companies: a => callRpc('search_companies', { p_type:a.type??null, p_industry:a.industry??null, p_area:a.area??null, p_status:a.status??null, p_needs:a.needs??null, p_offers:a.offers??null, p_keyword:a.keyword??null, p_limit:a.limit??20, p_size:a.size??null }),
  get_company: a => callRpc('get_company', { p_company:a.company_id, p_reveal:!!a.reveal_contact_info }),
  list_contacts: a => callRpc('list_contacts', { p_keyword:a.keyword??null, p_company:a.company??null, p_primary_only:!!a.primary_only, p_reveal:!!a.reveal_contact_info, p_limit:a.limit??50 }),
  find_matches: a => callRpc('find_matches', { p_company:a.company_id, p_limit:a.limit??10 }),
  suggest_matches: a => callRpc('suggest_matches', { p_limit:a.limit??10 }),
  list_tags: () => callRpc('list_tags', {}),
  get_masters: () => callRpc('get_masters', {}),
  get_newsletter_segment: a => callRpc('get_newsletter_segment', { p_topics:(a.topic_ids||a.topics||null), p_status:a.status??null, p_industry:a.industry??null, p_area:a.area??null }),
  search_documents: a => callRpc('search_documents', { p_keyword:a.keyword??null, p_category:a.category??null, p_company:a.company??null, p_limit:a.limit??50 }),
  get_company_timeline: a => callRpc('get_company_timeline', { p_company:a.company_id, p_kind:a.kind??null, p_source:a.source??null, p_limit:a.limit??30 }),
};

// ツールを実行（LIVE時はRPC、そうでなければデモ）。LIVE時のRPC失敗はエラーを返す（デモ値で誤魔化さない）。
async function runTool(name, args){
  if(LIVE && LIVE_HANDLERS[name]) return await LIVE_HANDLERS[name](args);
  return HANDLERS[name](args);
}

// ====================== JSON-RPC over stdio ======================
const SERVER_INFO = { name:'daikichi-crm-demo', version:'0.1.0' };
let PROTOCOL = '2024-11-05';
function send(msg){ process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result){ send({ jsonrpc:'2.0', id, result }); }
function err(id, code, message){ send({ jsonrpc:'2.0', id, error:{ code, message } }); }
function asText(obj){ return { content:[{ type:'text', text: typeof obj==='string' ? obj : JSON.stringify(obj, null, 2) }] }; }
function log(...a){ process.stderr.write('[crm-demo] '+a.join(' ')+'\n'); }  // stdoutはプロトコル専用→ログはstderr

function handle(msg){
  const { id, method, params } = msg;
  switch(method){
    case 'initialize':
      if(params?.protocolVersion) PROTOCOL = params.protocolVersion;
      return ok(id, { protocolVersion:PROTOCOL, capabilities:{ tools:{} }, serverInfo:SERVER_INFO });
    case 'notifications/initialized': case 'initialized': return; // 通知（応答不要）
    case 'ping': return ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name; const args = params?.arguments || {};
      if(!HANDLERS[name]) return ok(id, { ...asText(`未知のツール: ${name}`), isError:true });
      // LIVE(RPC)は非同期のため、応答は解決後に送る（他メソッドは同期のまま）。
      runTool(name, args)
        .then(result => ok(id, asText(result)))
        .catch(e => ok(id, { ...asText('エラー: '+(e?.message||e)), isError:true }));
      return;
    }
    default:
      if(id!==undefined) return err(id, -32601, `Method not found: ${method}`);
  }
}

let buf='';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk=>{
  buf += chunk;
  let nl;
  while((nl = buf.indexOf('\n')) >= 0){
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl+1);
    if(!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { log('parse error:', line); continue; }
    try { handle(msg); } catch(e){ log('handler error:', e?.message||e); }
  }
});
process.stdin.on('end', ()=> process.exit(0));
log(`started (read-only, ${LIVE ? `LIVE: Supabase RPC @ ${SUPA_URL}` : `demo data: ${COMPANIES.length} companies, ${DOCUMENTS.length} documents, ${ACTIVITIES.length} activities`})`);

/* §SUPABASE 本番化メモ（実装済み・上の LIVE_HANDLERS / callRpc）:
 *  - 有効化: 環境変数 SUPABASE_URL と 読み取り専用キー（SUPABASE_MCP_KEY 等）を設定すると
 *    各ツールが PostgREST の /rest/v1/rpc/<fn> を叩く。未設定ならデモデータ（既定）。
 *  - 認可: service_role は使わない。「読み取り専用ロール＋ホワイトリストRPCの EXECUTE」を想定
 *    （SEC-X3/X6）。DB側で対象RPCの列挙10関数のみに EXECUTE を付与し、RLSで read を制限する。
 *  - 鍵は process.env（ローカル）/ Cloudflare Secrets（リモート）から読み、Claudeには渡さない。
 *  - LIVE時のRPC失敗はエラーとして返す（デモ値で誤魔化さない）。
 */
