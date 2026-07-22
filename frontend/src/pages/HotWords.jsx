import { useState, useEffect } from 'react';
import { hotwordAPI, supabase } from '../api';

const CATEGORY_COLORS = {
  '人物': '#ef4444', '地点': '#3b82f6', '动词': '#10b981', '名词': '#7c3aed', 
  '形容词': '#f59e0b', '语气词': '#ec4899', '通用': '#94a3b8', '未分类': '#94a3b8',
};

// 前端内存版词性分类（不依赖数据库）
function classifyWord(word) {
  word = (word || '').toLowerCase();
  const rules = [
    { cat: '人物', words: ['爸爸','妈妈','奶奶','爷爷','孩子','小孩','宝宝','女儿','儿子','姐妹','兄弟','闺蜜','朋友','同事','老板','领导','老师','学生','专家','博主','素人','粉丝','顾客','客户','婆媳','男友','女友','前任','相亲对象','老公','老婆','婆婆','丈母娘','嫂子','大姑姐','亲戚','邻居','陌生人','帅哥','美女','女生','男生','女人','男人','女孩','男孩','大小姐','富婆','打工人','搬砖人','实习生','留学生','宝妈','辣妈','新手妈妈','孕妇','产妇','巨蟹座','天蝎座','双鱼','狮子','射手','摩羯','水瓶','天秤','处女','双子','金牛','白羊'] },
    { cat: '地点', words: ['家','酒店','餐厅','咖啡馆','奶茶店','商场','超市','地铁','公交','机场','火车站','学校','公司','办公室','健身房','医院','理发店','美甲店','电影院','书店','公园','海边','山上','民宿','日本','韩国','上海','北京','深圳','成都','杭州','武汉','南京','西安','长沙','重庆','厦门','三亚','大理','丽江','香港','澳门','自习室','图书馆','展览','寝室','宿舍','出租屋','厨房','卫生间','卧室','客厅','阳台'] },
    { cat: '动词', words: ['学习','工作','加班','出差','面试','入职','离职','辞职','创业','搞钱','赚钱','存钱','花钱','买','卖','送','收','吃','喝','看','听','说','写','拍','做','玩','去','来','回','走','跑','坐','站','躺','睡','醒','逛街','旅行','打卡','探店','拍照','修图','分享','收藏','点赞','评论','转发','私信','关注','取关','表白','分手','和好','吵架','冷战','复合','暗恋','喜欢','爱','讨厌','恨','嫉妒','吃醋','下单','购买','入手','推荐','安利','测评','试用','体验','踩雷','回购','空瓶','囤货'] },
    { cat: '名词', words: ['手机','电脑','苹果','华为','小米','相机','键盘','鼠标','耳机','手表','包','口红','面膜','香水','护肤品','化妆品','精华','面霜','防晒','隔离','粉底','眉笔','眼影','腮红','洗面奶','卸妆','衣服','裤子','裙子','鞋子','袜子','帽子','首饰','项链','戒指','耳环','发型','颜色','好物','神物','宝藏','平替','贵替','大牌','小众','国货','网红款','爆款','奶茶','咖啡','面包','蛋糕','火锅','零食','早饭','午饭','晚饭','宵夜','外卖','菜谱','小红书','抖音','微博','微信','朋友圈','公众号','视频号','电视剧','综艺','vlog','plog','emoji','表情包','音乐','歌曲','短发','长发','卷发','直发','刘海','白色','黑色','红色','粉色','蓝色','绿色'] },
    { cat: '形容词', words: ['好看','漂亮','美','帅','高级','温柔','可爱','性感','高冷','治愈','好吃','难吃','实用','好用','难用','便宜','贵','划算','真香','上头','下头','无语','崩溃','开心','难过','emo','焦虑','迷茫','恐惧','自卑','自信','后悔','满足','幸福','快乐','轻松','沉重','疲惫','精神','兴奋','冷静','淡定','烦躁','离谱','夸张','好笑','有趣','无聊','玄学','神秘','神奇','干净','整洁','温馨','简约','浮夸','土','洋气','时髦','潮流','经典','热门','冷门','小众','精致','粗糙','爆款','恶心','绝','赞','棒','顶','牛','香','甜','咸','辣','淡','浓','清淡'] },
    { cat: '语气词', words: ['真的','天哪','绝了','疯了','醉了','救命','笑死','无语死','服了','不得不说','说实话','真心','终于','结果','然后','而且','但是','可是','所以','因为','总之','反正','确实','其实','根本','完全','绝对','一定','必须','千万不要','千万别','求求你','拜托','算了','好啦','OK','okk','哈哈','嘿嘿','嘻嘻','哦哦','嗯嗯','啊啊','耶','呜','老天爷','我的天','天啊','笑死我了','哈哈哈','呵呵'] },
  ];
  let bestCat = '名词';
  let bestScore = 0;
  for (const rule of rules) {
    let score = 0;
    for (const w of rule.words) {
      if (word.includes(w) || w.includes(word)) score += 2;
      if (word === w) score += 5;
    }
    if (score > bestScore) { bestScore = score; bestCat = rule.cat; }
  }
  return bestCat;
}

export default function HotWords({ onNavigate }) {
  const [words, setWords] = useState([]);
  const [trending, setTrending] = useState([]);
  const [comboWord, setComboWord] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [comboLoading, setComboLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newWordBatch, setNewWordBatch] = useState('');
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [previewCat, setPreviewCat] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    hotwordAPI.top(500).then(data => {
      const classified = (data || []).map(w => ({ ...w, category: classifyWord(w.word) }));
      setWords(classified);
    }).catch(console.error);
    hotwordAPI.trending().then(setTrending).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newWord.trim().length >= 1) {
        hotwordAPI.previewCategory(newWord.trim()).then(setPreviewCat).catch(() => setPreviewCat(null));
      } else {
        setPreviewCat(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [newWord]);

  const handleCombo = async () => {
    if (!comboWord.trim()) return;
    setComboLoading(true);
    try {
      const data = await hotwordAPI.combinations(comboWord.trim());
      setCombinations(data);
    } catch (e) { console.error(e); }
    setComboLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await hotwordAPI.refresh();
      load();
    } catch (e) { alert('刷新失败: ' + e.message); }
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (!newWord.trim()) return;
    setAdding(true);
    try {
      await hotwordAPI.add(newWord.trim());
      setNewWord('');
      setPreviewCat(null);
      load();
    } catch (e) { alert('添加失败: ' + e.message); }
    setAdding(false);
  };

  const handleBatchAdd = async () => {
    if (!newWordBatch.trim()) return;
    const items = newWordBatch.split(/[\\n,，]/).map(w => w.trim()).filter(Boolean);
    if (items.length === 0) return;
    setAdding(true);
    try {
      const result = await hotwordAPI.addMany(items);
      alert('成功添加 ' + result.count + ' 个热词！');
      setNewWordBatch('');
      setShowBatchAdd(false);
      load();
    } catch (e) { alert('批量添加失败: ' + e.message); }
    setAdding(false);
  };

  const handleRecategorize = () => {
    setWords(prev => prev.map(w => ({ ...w, category: classifyWord(w.word) })));
  };

  const handleDelete = async (word) => {
    if (!confirm('确定要删除热词「' + word + '」吗？')) return;
    try {
      await supabase.from('hotwords').delete().eq('word', word);
      load();
    } catch (e) { alert('删除失败: ' + e.message); }
  };

  const grouped = {};
  words.forEach(w => {
    const cat = w.category || '未分类';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  });
  const sortedCategories = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#212529', margin: 0 }}>热词实验室</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRecategorize} style={{
            padding: '6px 14px', backgroundColor: '#f3f0ff', color: '#7c3aed',
            border: '1px solid #d8b4fe', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}>📋 重新分组</button>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '6px 14px', backgroundColor: '#fff', border: '1px solid #dee2e6',
            borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#495057',
          }}>{refreshing ? '刷新中...' : '🔄 刷新热词'}</button>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>➕ 手动添加热词</div>
          <button onClick={() => setShowBatchAdd(!showBatchAdd)} style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {showBatchAdd ? '收起' : '批量添加'}
          </button>
        </div>
        {!showBatchAdd ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                placeholder="输入一个热词，如：水逆 / 爆款 / 焦虑"
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ ...inputStyle, width: '100%', paddingRight: 70 }}
              />
              {previewCat && (
                <div style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                  backgroundColor: CATEGORY_COLORS[previewCat.category] || '#94a3b8', color: '#fff',
                }}>
                  {previewCat.category}
                </div>
              )}
            </div>
            <button onClick={handleAdd} disabled={adding || !newWord.trim()} style={btnPrimaryStyle}>
              {adding ? '添加中...' : '添加'}
            </button>
          </div>
        ) : (
          <div>
            <textarea
              placeholder={'多个热词用换行或逗号分隔，如：\n水逆\n爆款\n焦虑\ncrush'}
              value={newWordBatch}
              onChange={e => setNewWordBatch(e.target.value)}
              rows={4}
              style={{ ...textareaStyle, marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, color: '#868e96', marginBottom: 8 }}>
              自动识别词性：人物 / 地点 / 动词 / 名词 / 形容词 / 语气词
            </div>
            <button onClick={handleBatchAdd} disabled={adding || !newWordBatch.trim()} style={btnPrimaryStyle}>
              {adding ? '添加中...' : '批量添加'}
            </button>
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>热词联想组合</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="输入一个热词，如：水逆、爆款、情绪..."
            value={comboWord}
            onChange={e => setComboWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCombo()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleCombo} disabled={comboLoading} style={btnPrimaryStyle}>
            {comboLoading ? '查询中...' : '联想'}
          </button>
        </div>
        {combinations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', marginBottom: 10 }}>组合灵感</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {combinations.map((c, i) => (
                <div key={i} style={{
                  padding: 12, borderRadius: 8, backgroundColor: '#f8f9fa', border: '1px solid #e9ecef',
                  cursor: 'pointer',
                }} onClick={() => setComboWord(c.word)}>
                  <div style={{ fontSize: 14, color: '#7c3aed', fontWeight: 600, marginBottom: 6 }}>{c.word}</div>
                  {c.parts && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(c.parts).map(([dim, w]) => (
                        <span key={dim} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#fff', color: '#495057', border: '1px solid #dee2e6' }}>
                          {dim}: {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 按分类展示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#212529', margin: 0 }}>按词性分类</h3>
        <div style={{ fontSize: 12, color: '#868e96' }}>{words.length} 个 · {sortedCategories.length} 类</div>
      </div>

      {sortedCategories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#868e96' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14 }}>热词库是空的，点上方手动添加或刷新热词</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedCategories.map(cat => (
            <div key={cat} style={{
              padding: 14, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef',
              borderLeft: '3px solid ' + (CATEGORY_COLORS[cat] || '#94a3b8'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: CATEGORY_COLORS[cat] || '#475569' }}>
                  🏷 {cat}
                </span>
                <span style={{ fontSize: 11, color: '#868e96' }}>({grouped[cat].length} 个)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {grouped[cat].map(w => (
                  <span key={w.word} style={{
                    padding: '4px 10px', borderRadius: 14, backgroundColor: '#f8f9fa',
                    color: '#495057', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                    cursor: 'pointer',
                  }} onClick={() => setComboWord(w.word)} title={'点击搜索组合 · 频次: ' + w.count}>
                    {w.word}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>({w.count})</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(w.word); }} style={{
                      background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0,
                    }} title="删除">×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 14, outline: 'none' };
const textareaStyle = { padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' };
const panelStyle = { padding: 16, borderRadius: 10, backgroundColor: '#fff', border: '1px solid #e9ecef' };
const btnPrimaryStyle = { padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' };
