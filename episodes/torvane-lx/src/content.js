// Every string shown on screen. Part names and what each part does only: no performance figures anywhere.
// After editing, run `node scripts/fonts.mjs` so the bundled font subset covers the new characters.
export const BRAND = 'Torvane LX';
export const TAGLINE = '雙導軌滾珠螺桿線性滑台';
export const DEMO_TAG = '示範 Demo';
export const END_TAG = '示範 Demo｜AX Lab';

export const LABELS = [
  {id: 'motor', en: 'STEPPER MOTOR', zh: '步進馬達', fn: '提供可控的旋轉動力'},
  {id: 'coupling', en: 'COUPLING', zh: '聯軸器', fn: '連接馬達軸與螺桿'},
  {id: 'support', en: 'BEARING SUPPORT', zh: '軸承支撐座', fn: '支撐螺桿兩端旋轉'},
  {id: 'screw', en: 'BALL SCREW', zh: '滾珠螺桿', fn: '把旋轉轉成直線推力'},
  {id: 'nut', en: 'BALL NUT', zh: '滾珠螺帽', fn: '沿螺桿移動，帶動滑座'},
  {id: 'table', en: 'SLIDE TABLE', zh: '滑座', fn: '承載工件的移動平台'},
  {id: 'blocks', en: 'CARRIAGE BLOCKS', zh: '滑塊', fn: '鋼珠循環滾動，支撐滑座'},
  {id: 'rails', en: 'LINEAR GUIDE RAILS', zh: '線性導軌', fn: '雙軌並列，引導直線方向'},
  {id: 'base', en: 'ALUMINIUM BASE', zh: '鋁合金底座', fn: '全機的安裝基準面'},
  {id: 'endcap', en: 'END CAP', zh: '端蓋', fn: '封閉軸端，阻擋粉塵'},
];

export const UI = {
  play: '播放', pause: '暫停', free: '自由檢視', film: '回到影片', assembled: '組裝', exploded: '分解', run: '運轉',
  landscape: '橫式', portrait: '直式', hint: '拖曳旋轉・滾輪縮放',
};
