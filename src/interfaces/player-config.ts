import { fail } from "assert";
import { CityName } from "../data/cicies";
import { role_resonanceskills } from "../data/roleSkills"

export var BotConfig:PlayerConfig = {
  maxLot: 1016,
  tradeLevel: 75,
  bargain: {
    bargainPercent: 20,
    raisePercent: 20,
    bargainFatigue: 20,
    raiseFatigue: 20,
    disabled: false
  },
  returnBargain: {
    bargainPercent: 20,
    raisePercent: 20,
    bargainFatigue: 20,
    raiseFatigue: 20,
    disabled: false
  },
  prestige: {
    "修格里城": 20,
    "铁盟哨站": 20,
    "七号自由港": 20,
    "澄明数据中心": 20,
    "阿妮塔战备工厂": 20,
    "阿妮塔能源研究所": 20,
    "荒原站": 20,
    "曼德矿场": 20,
    "淘金乐园": 20,
    "阿妮塔发射中心": 20,
    "海角城": 20,
    "铁山城": 20,
    "贡露城": 20,
    "岚心城": 20
  },
  roles: role_resonanceskills,
  onegraph: {
    maxRestock: 4,
    goAndReturn: true,
    showFatigue: true,
    showGeneralProfitIndex: true,
    enableMultiConfig: false,
    displayMode: "list",
    showProfitPerRestock: true
  },
  productUnlockStatus: {
    弹丸加速装置: true,
    汽配零件: true,
    孔雀石: true,
    发动机: true,
    琥珀: true,
    防弹背心: true,
    精钢: true,
    沙金: true,
    图形加速卡: true,
    铁轨用特种钢材: true,
    青金石: true,
    钛矿石: true,
    阿妮塔小型桦树发电机: true,
    阿妮塔101民用无人机: true,
    桦石发财树: true,
    石墨烯: true,
    人工晶花: true,
    家用太阳能电池组: true,
    石墨烯电池: true,
    游戏卡带: true,
    游戏机: true,
    银矿石: true,
    火澄石: true,
    负片炮弹: true,
    抗污染防护服: true,
    花呢上衣: true,
    单晶硅: true,
    学会书籍: true,
    蕾丝连衣裙: true,
    太阳电池阵: true,
    蜂窝防热烧蚀材料: true,
    航天半导体: true,
    高导热陶瓷: true,
    芳纶纤维: true,
    学会纪念品: true,
    鱼肝油: true,
    随身听: true,
    鹅绒: true,
    刀具: true,
    碳钢匕首: true,
    黑毛牛排: true,
    岚心锦服: true
  },
  events: {
    "红茶战争": { activated: false }
  }
}

export var BotConfigNoReturnBargain:PlayerConfig = {
  maxLot: 1016,
  tradeLevel: 75,
  bargain: {
    bargainPercent: 20,
    raisePercent: 20,
    bargainFatigue: 20,
    raiseFatigue: 20,
    disabled: false
  },
  returnBargain: {
    bargainPercent: 20,
    raisePercent: 20,
    bargainFatigue: 20,
    raiseFatigue: 20,
    disabled: true
  },
  prestige: {
    "修格里城": 20,
    "铁盟哨站": 20,
    "七号自由港": 20,
    "澄明数据中心": 20,
    "阿妮塔战备工厂": 20,
    "阿妮塔能源研究所": 20,
    "荒原站": 20,
    "曼德矿场": 20,
    "淘金乐园": 20,
    "阿妮塔发射中心": 20,
    "海角城": 20,
    "铁山城": 20,
    "贡露城": 20,
    "岚心城": 20
  },
  roles: role_resonanceskills,
  onegraph: {
    maxRestock: 4,
    goAndReturn: true,
    showFatigue: true,
    showGeneralProfitIndex: true,
    enableMultiConfig: false,
    displayMode: "list",
    showProfitPerRestock: true
  },
  productUnlockStatus: {
    弹丸加速装置: true,
    汽配零件: true,
    孔雀石: true,
    发动机: true,
    琥珀: true,
    防弹背心: true,
    精钢: true,
    沙金: true,
    图形加速卡: true,
    铁轨用特种钢材: true,
    青金石: true,
    钛矿石: true,
    阿妮塔小型桦树发电机: true,
    阿妮塔101民用无人机: true,
    桦石发财树: true,
    石墨烯: true,
    人工晶花: true,
    家用太阳能电池组: true,
    石墨烯电池: true,
    游戏卡带: true,
    游戏机: true,
    银矿石: true,
    火澄石: true,
    负片炮弹: true,
    抗污染防护服: true,
    花呢上衣: true,
    单晶硅: true,
    学会书籍: true,
    蕾丝连衣裙: true,
    太阳电池阵: true,
    蜂窝防热烧蚀材料: true,
    航天半导体: true,
    高导热陶瓷: true,
    芳纶纤维: true,
    学会纪念品: true,
    鱼肝油: true,
    随身听: true,
    鹅绒: true,
    刀具: true,
    碳钢匕首: true,
    黑毛牛排: true,
    岚心锦服: true
  },
  events: {
    "红茶战争": { activated: false }
  }
}

export interface PlayerConfig {
  maxLot: number;
  tradeLevel: number;
  bargain: PlayerConfigBargain;
  returnBargain: PlayerConfigBargain;
  prestige: PlayerConfigPrestige;
  roles: PlayerConfigRoles;
  onegraph: PlayerConfigOnegraph;
  productUnlockStatus: PlayerConfigProductUnlockStatus;
  events: PlayerConfigEvents;
  nanoid?: string;
}

export interface PlayerConfigEvents {
    [eventName: string]: {
        activated: boolean;
    };
}


export interface PlayerConfigBargain {
  bargainPercent: number;
  raisePercent: number;
  bargainFatigue: number;
  raiseFatigue: number;
  disabled: boolean;
}

export interface PlayerConfigPrestige {
  [cityName: CityName]: number;
}

export interface PlayerConfigRoles {
  [roleName: string]: {
    resonance: number;
  };
}

export interface PlayerConfigOnegraph {
  maxRestock: number;
  goAndReturn: boolean;
  showFatigue: boolean; // actually is showProfitPerFatigue
  /**
   * @deprecated
   */
  showProfitPerRestock: boolean;
  showGeneralProfitIndex: boolean;
  enableMultiConfig: boolean;
  displayMode: "table" | "list";
}

export interface PlayerConfigProductUnlockStatus {
  [pdtName: string]: boolean; // false is not unlocked yet, by default all products are unlocked, this should be set to false if the product is not unlocked
}
