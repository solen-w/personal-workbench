// 授权账号来自用户指定的转换结果；这里只提供前端入口校验。
export const AUTHORIZED_ACCOUNTS = Object.freeze(["15858672825"]);
export const NAV_GROUPS = [
  {
    "title": "个人系统",
    "items": [
      "基础情况",
      "学工经历",
      "财务管理"
    ]
  },
  {
    "title": "生活系统",
    "items": [
      "身体跟踪",
      "习惯养成",
      "图书管理"
    ]
  },
  {
    "title": "目标系统",
    "items": [
      "运动挑战",
      "专项攻克",
      "理论学习"
    ]
  },
  {
    "title": "文件系统",
    "items": [
      "工作要求",
      "政策法规",
      "素材收集"
    ]
  }
];
export const MODULE_ALIASES = Object.freeze({"命宫本元": "基础情况", "履迹平生": "学工经历", "财帛大有": "财务管理", "乾元矢志": "专项攻克", "恒久不已": "习惯养成", "文曲含章": "素材收集", "万象包罗": "素材收集", "继明开卷": "图书管理", "申命行事": "工作要求", "节以制度": "政策法规"});
export const CATEGORY_NAMES = Object.freeze(NAV_GROUPS.flatMap(group => group.items));
export const DEFAULT_CATEGORY = CATEGORY_NAMES[0];
export function isAuthorizedAccount(value) { return AUTHORIZED_ACCOUNTS.includes(String(value).trim()); }
