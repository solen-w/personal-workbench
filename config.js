// 授权账号来自用户指定的转换结果；这里只提供前端入口校验。
export const AUTHORIZED_ACCOUNTS = Object.freeze(["15858672825"]);
export const NAV_GROUPS = [
  {
    "title": "命宫定盘",
    "items": [
      "命宫本元",
      "履迹平生",
      "财帛大有"
    ]
  },
  {
    "title": "天行乾元",
    "items": [
      "乾元矢志",
      "恒久不已"
    ]
  },
  {
    "title": "坤厚载物",
    "items": [
      "文曲含章",
      "万象包罗"
    ]
  },
  {
    "title": "果行育德",
    "items": [
      "继明开卷"
    ]
  },
  {
    "title": "归藏止静",
    "items": [
      "申命行事",
      "节以制度"
    ]
  }
];
export const CATEGORY_NAMES = Object.freeze(NAV_GROUPS.flatMap(group => group.items));
export const DEFAULT_CATEGORY = CATEGORY_NAMES[0];
export function isAuthorizedAccount(value) { return AUTHORIZED_ACCOUNTS.includes(String(value).trim()); }
