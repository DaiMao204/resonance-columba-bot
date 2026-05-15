import { Context, Schema, h, Bot, Dict } from 'koishi'
import { cityList, cityItemList,cityListSteam } from './data/cicies'
import { products_default } from './data/data'
import { products_default_steam } from './data/data-steam'
import { intervalTime } from './utils/time'
import axios from 'axios';
import { GetPricesProducts } from './interfaces/get-prices';
import { convertFirebaseDataToGetPricesData,convertFirebaseDataToGetPricesDataNew } from './utils/price-api-utils'
import { calculateOneGraphBuyCombinations,getOneGraphRecommendation,calculateGeneralProfitIndex,getGameEventBuyMorePercent,getGameEventTaxVariation,getResonanceSkillBuyMorePercent,getResonanceSkillTaxCutPercent } from './utils/route-page-utils'
import { BotConfig, BotConfigNoReturnBargain, BotConfigSteam, BotConfigNoReturnBargainSteam } from './interfaces/player-config';
import { CITIES,CITIESSTEAM,CITY_BELONGS_TO } from './data/cicies';
import { OnegraphRecommendations,OnegraphBuyCombinationStats,OnegraphTopProfit,OnegraphTopProfitItem,OnegraphTopProfitSortedBy } from './interfaces/route-page';
import { replaceKeysAndValues,items_chinese,items_japanese,citys_chinese,citys_japanese } from './data/translate';
import { PRODUCTS } from './data/products';
import { updata_columba_data } from './data/get-data';
import { cityItems_set } from './data/cicies';
import { toSimplified } from './utils/chinese';
import { it } from 'node:test';
import { findFatigue } from './data/fatigue';
import { PRESTIGES } from './data/prestige';

export const name = 'resonance-columba-bot'

export interface Config {
  QQID: string
  DataUrl: string
  TimerTime: number
  SmallPrice: number
  BigPrice: number
  LowSmallPrice: number
  LowBigPrice: number
  ShortTeamList: Array<string>
  TeamList: Array<string>
  ErrorTeamList: Array<string>
  MaxTeamList: Array<string>
  ErrorItemList: Array<string>
  SteamOpen: boolean
  SteamTeamList: Array<string>
  SpecialCurrencyMarketOpen: Dict<boolean>
  ItemSendList: Dict<Dict<ConfigItemList,string> , string>
  StartUrl: string
}

export interface ConfigItemList {
  variation:Array<number>
  type:string
  city:Array<string>
  send:boolean
}

var qqID = ""

var getDataUrl = "";


var min = 0

export var errorNum = 0

var low_min = 0

export const ConfigItemList: Schema<ConfigItemList> = Schema.object({
  variation: Schema.array(Schema.number()).description("幅度阈值"),
  type: Schema.string().description("购买幅度还是出售幅度（填写 buy / sell)"),
  city: Schema.array(Schema.string()).description("城市名称"),
  send: Schema.boolean().default(false).description("是否@全体")
})

export const Config: Schema<Config> = Schema.object({
  QQID: Schema.string().description("机器人QQ号"),
  DataUrl: Schema.string().description("数据获取来源"),
  TimerTime: Schema.number().default(1).description("数据刷新时间（单位：分）"),
  SmallPrice: Schema.number().default(7500).description("小行情判断阈值"),
  BigPrice: Schema.number().default(7800).description("大行情判断阈值"),
  LowSmallPrice: Schema.number().default(7e3).description("无海角小行情判断阈值"),
  LowBigPrice: Schema.number().default(7300).description("无海角大行情判断阈值"),
  ShortTeamList: Schema.array(Schema.string()).default([]).description("极简模式群组列表"),
  TeamList: Schema.array(Schema.string()).default([]).description("行情通知广播群组列表"),
  ErrorTeamList: Schema.array(Schema.string()).default([]).description("错误提醒广播群组列表"),
  MaxTeamList: Schema.array(Schema.string()).default([]).description("@全体大行情通知群组列表"),
  ErrorItemList: Schema.array(Schema.string()).default([]).description("屏蔽商品名称列表"),
  SteamOpen:Schema.boolean().default(false).description("是否开启steam服行情"),
  SteamTeamList: Schema.array(Schema.string()).default([]).description("steam服群组列表"),
  SpecialCurrencyMarketOpen: Schema.dict(Schema.boolean()).default({ 交子: true }).description("特殊货币城市开关，键可填货币名、城市名或内部 key"),
  ItemSendList: Schema.dict(Schema.dict(ConfigItemList.description("商品名称"), Schema.string()).description("群号"), Schema.string()).description("商品行情通告表"),
  StartUrl: Schema.string().description("启动APIURL，默认留空")
})

var ItemSendList

var output_str = ""

var low_output_str = ""

var small_output_str = "";

var short_output_str = "";

var output_str_steam = ""

var low_output_str_steam = ""

var small_output_str_steam = "";

var short_output_str_steam = "";

var jiaozi_output_str = "交子行情暂无数据";

var jiaozi_short_output_str = "交子行情暂无数据";

var mixed_total_first_output_str = "跨币行情暂无数据";

var mixed_total_first_short_output_str = "跨币行情暂无数据";

var mixed_jiaozi_first_output_str = "跨币行情暂无数据";

var mixed_jiaozi_first_short_output_str = "跨币行情暂无数据";

var mixed_tiemeng_first_output_str = "跨币行情暂无数据";

var mixed_tiemeng_first_short_output_str = "跨币行情暂无数据";

var xiuwu_output_str = "修武行情暂无数据";

var xiuwu_short_output_str = "修武行情暂无数据";



export var responseData: GetPricesProducts
export var responseDataSteam: GetPricesProducts
export var responseDataJiaozi: GetPricesProducts


var intervalID

var intervalIDSteam

var intervalID2;

var send_flag_small:boolean = true

var send_flag_big:boolean = true

var send_flag_low_small:boolean = true

var send_flag_low_big:boolean = true

var send_flag_max:boolean = true;



var updataFlag = true

var updataNum = 0

var ShortTeamList = [];

var TeamList = []

var MaxTeamList;

var ErrorTeamList = ['838573532']

var ErrorItemList = []

var ItemMaxPrice;

var ItemMaxPriceSteam;

var SteamTeamList = [];

var SpecialCurrencyMarketOpen: Dict<boolean> = {};

const adminQQList = ["1443197830"];

function isAdminSession(session) {
  return adminQQList.includes(session?.userId);
}

function isShortTeamRestricted(session) {
  return !isAdminSession(session) && ShortTeamList.indexOf(session.channelId) !== -1;
}

const defaultProductNames = new Set<string>(products_default.map((product) => product.name));
const steamProductNames = new Set<string>(products_default_steam.map((product) => product.name));

type MixedCurrencyMarketMode = "jiaozi-only" | "mixed-total-first" | "mixed-jiaozi-first" | "mixed-tiemeng-first";
type MixedCurrencySortBy = "total" | "jiaozi" | "tiemeng";
type ShortcutMode = "0" | "1" | "2";

interface SpecialCurrencyMarketConfig {
  key: string;
  cityName: string;
  currencyName: string;
  baseCurrencyName: string;
  commandKeywords: string[];
  cityKeywords: string[];
  maxRestock: number;
  priceDivisorFromBase: number;
}

const specialCurrencyMarkets: SpecialCurrencyMarketConfig[] = [
  {
    key: "jiaozi",
    cityName: "武林源",
    currencyName: "交子",
    baseCurrencyName: "铁盟币",
    commandKeywords: ["交子", "武林"],
    cityKeywords: ["武林源", "武林"],
    maxRestock: 6,
    priceDivisorFromBase: 20,
  },
];

const jiaoziMarketConfig = specialCurrencyMarkets[0];
const wulinyuanCityName = jiaoziMarketConfig.cityName;
const wulinyuanMaxRestock = jiaoziMarketConfig.maxRestock;
const xiuwuCityName = "修格里城";
const xiuwuCommandName = "修武";

function removeProductsWithUnknownBuyCities(goodsData: GetPricesProducts, knownCities: string[], knownProductNames: Set<string>) {
  const knownTradeCities = new Set<string>(knownCities);
  for (const goodsName in goodsData) {
    if (knownProductNames.has(goodsName))
      continue;
    const buyData = goodsData[goodsName]?.buy;
    if (!buyData || Object.keys(buyData).length === 0) {
      delete goodsData[goodsName];
      continue;
    }
    if (Object.keys(buyData).some((cityName) => !knownTradeCities.has(cityName))) {
      delete goodsData[goodsName];
    }
  }
  return goodsData;
}

function specialMarketMatchesCommand(market: SpecialCurrencyMarketConfig, command: string) {
  return market.commandKeywords.some((keyword) => command.includes(keyword));
}

function specialMarketMatchesCity(market: SpecialCurrencyMarketConfig, item: string) {
  return market.cityKeywords.some((keyword) => keyword.includes(item) || item.includes(keyword));
}

function convertBasePriceToSpecialCurrency(price: number, market: SpecialCurrencyMarketConfig) {
  return Math.ceil(price / market.priceDivisorFromBase);
}

function formatSpecialCurrencyPrice(price: number, market: SpecialCurrencyMarketConfig) {
  return `${convertBasePriceToSpecialCurrency(price, market)}${market.currencyName}`;
}

function isSpecialCurrencyMarketEnabled(market: SpecialCurrencyMarketConfig) {
  // 同时支持按内部 key、货币名或城市名开关，任一项明确为 false 都会关闭该特殊市场。
  const switches = SpecialCurrencyMarketOpen ?? {};
  const values = [switches[market.key], switches[market.currencyName], switches[market.cityName]];
  return !values.some((value) => value === false);
}

function getEnabledSpecialCurrencyMarkets() {
  return specialCurrencyMarkets.filter((market) => isSpecialCurrencyMarketEnabled(market));
}

function getSpecialCurrencyCityList() {
  return [...cityList, ...getEnabledSpecialCurrencyMarkets().map((market) => market.cityName)];
}

function getSpecialCurrencyPlayerConfig(market: SpecialCurrencyMarketConfig) {
  // 特殊货币城市默认按满声望参与税率和购买量计算。
  return {
    ...BotConfig,
    prestige: {
      ...BotConfig.prestige,
      [market.cityName]: BotConfig.prestige[market.cityName] ?? 20,
    },
  };
}

function getSpecialCurrencyNameForRoute(market: SpecialCurrencyMarketConfig, fromCity: string, toCity: string, type: "cost" | "income") {
  // 出发地决定买入花费货币，目的地决定卖出收入货币。
  if (type === "cost") {
    return fromCity === market.cityName ? market.currencyName : market.baseCurrencyName;
  }
  return toCity === market.cityName ? market.currencyName : market.baseCurrencyName;
}

function getWulinyuanPlayerConfig() {
  return getSpecialCurrencyPlayerConfig(jiaoziMarketConfig);
}

function getWulinyuanReturnBargainOptions() {
  return [
    { name: "回程抬砍", bargain: BotConfig.returnBargain },
    { name: "回程不抬砍", bargain: BotConfigNoReturnBargain.returnBargain },
  ];
}

function getJiaoziMarketOutput(goodsData: GetPricesProducts) {
  return getWulinyuanRouteOutput(goodsData, "jiaozi-only");
}

function getMixedCurrencyMarketOutput(goodsData: GetPricesProducts, sortBy: MixedCurrencySortBy) {
  // 0/1/2 三种模式只改变排序目标，不改变往返计算流程。
  if (sortBy === "total") {
    return getWulinyuanRouteOutput(goodsData, "mixed-total-first");
  }
  return getWulinyuanRouteOutput(goodsData, sortBy === "jiaozi" ? "mixed-jiaozi-first" : "mixed-tiemeng-first");
}

function findBestCurrencyIncomeRoute(goodsData: GetPricesProducts, fromCities: string[], toCities: string[], restock: number, bargainConfig = BotConfig.bargain, bargainLabel = "抬砍") {
  // 单程候选：记录目标货币收入和出发地货币花费，供往返时做净收益结算。
  const config = getWulinyuanPlayerConfig();
  let best = null;
  for (const fromCity of fromCities) {
    const fromCityMaster = CITY_BELONGS_TO[fromCity] ?? fromCity;
    const buyPrestige = PRESTIGES.find((p) => p.level === config.prestige[fromCityMaster]);
    if (!buyPrestige) {
      continue;
    }
    const resonanceSkillTaxCutPercent = getResonanceSkillTaxCutPercent(config.roles, fromCity as any);
    for (const toCity of toCities) {
      const toCityMaster = CITY_BELONGS_TO[toCity] ?? toCity;
      const sellPrestige = PRESTIGES.find((p) => p.level === config.prestige[toCityMaster]);
      const fatigue = findFatigue(fromCity, toCity, config.roles) ?? 0;
      if (!sellPrestige || !fatigue) {
        continue;
      }
      const productCandidates = [];
      for (const goodsName in goodsData) {
        const product = products_default.find((it) => it.name === goodsName) as any;
        if (!product || product.type === "Craft") {
          continue;
        }
        if (config.productUnlockStatus?.[goodsName] === false) {
          continue;
        }
        const buyData = goodsData[goodsName]?.buy?.[fromCity];
        const sellData = goodsData[goodsName]?.sell?.[toCity];
        if (!buyData?.price || !sellData?.price) {
          continue;
        }
        const buyLotBase = product.buyLot?.[fromCity] ?? 0;
        if (!buyLotBase) {
          continue;
        }
        const buyMorePercent =
          getResonanceSkillBuyMorePercent(config.roles, product, fromCity as any) +
          buyPrestige.extraBuy * 100 +
          getGameEventBuyMorePercent(product, fromCity as any, config.events);
        const buyLot = Math.round((buyLotBase * (100 + buyMorePercent)) / 100);
        const lot = Math.min(config.maxLot, buyLot * (restock + 1));
        if (!lot) {
          continue;
        }
        // 买入花费属于出发地货币，往返结算时会从对应货币收益里扣掉。
        const bargain = bargainConfig.disabled ? 0 : bargainConfig.bargainPercent ?? 0;
        const buyPrice = Math.round(buyData.price * (1 - bargain / 100));
        let buyTaxRate = buyPrestige.specialTax[fromCityMaster] ?? buyPrestige.generalTax;
        buyTaxRate += getGameEventTaxVariation(product, fromCity as any, config.events) + resonanceSkillTaxCutPercent;
        const singleCost = Math.round(buyPrice * (1 + buyTaxRate));
        // 卖出收入属于目的地货币，税后收入用于计算该货币的收益。
        const raise = bargainConfig.disabled ? 0 : bargainConfig.raisePercent ?? 0;
        const sellPrice = Math.round(sellData.price * (1 + raise / 100));
        let sellTaxRate = sellPrestige.specialTax[toCityMaster] ?? sellPrestige.generalTax;
        sellTaxRate += resonanceSkillTaxCutPercent;
        const singleIncome = Math.round(sellPrice * (1 - sellTaxRate));
        if (singleIncome <= 0) {
          continue;
        }
        productCandidates.push({
          productName: goodsName,
          availableLot: lot,
          buyPrice,
          buyTaxRate,
          singleCost,
          sellPrice,
          sellTaxRate,
          singleIncome,
          singleNetProfit: singleIncome - singleCost,
          bargainPercent: bargain,
          raisePercent: raise,
          bargainLabel,
        });
      }
      // 按旧逻辑混装：单件净收益高的商品先装，直到货仓满或候选耗尽。
      productCandidates.sort((a, b) => b.singleNetProfit - a.singleNetProfit);
      let usedLot = 0;
      let bestRouteProfit = 0;
      let bestRouteCost = 0;
      const bestRouteDetails = [];
      for (const candidate of productCandidates) {
        if (usedLot >= config.maxLot) {
          break;
        }
        const lot = Math.min(config.maxLot - usedLot, candidate.availableLot);
        if (!lot) {
          continue;
        }
        usedLot += lot;
        const totalIncome = candidate.singleIncome * lot;
        const totalCost = candidate.singleCost * lot;
        bestRouteProfit += totalIncome;
        bestRouteCost += totalCost;
        bestRouteDetails.push({
          ...candidate,
          lot,
          totalCost,
          totalIncome,
        });
      }
      if (bestRouteProfit <= 0) {
        continue;
      }
      const totalFatigue = fatigue + (bargainConfig.disabled ? 0 : bargainConfig.bargainFatigue + bargainConfig.raiseFatigue);
      const generalProfitIndex = calculateGeneralProfitIndex(bestRouteProfit, totalFatigue, restock);
      const route = { fromCity, toCity, restock, profit: bestRouteProfit, cost: bestRouteCost, fatigue: totalFatigue, generalProfitIndex, bargainLabel, detail: bestRouteDetails };
      if (!best || generalProfitIndex > best.generalProfitIndex) {
        best = route;
      }
    }
  }
  return best;
}

function findBestWulinyuanPair(goodsData: GetPricesProducts, totalRestock: number, mode: Extract<MixedCurrencyMarketMode, "mixed-total-first" | "mixed-jiaozi-first" | "mixed-tiemeng-first">, candidateCities = cityList) {
  // 严格按旧往返逻辑枚举：给定总书数 N，尝试 0+N 到 N+0 的所有分配。
  let best = null;
  for (const cityName of candidateCities) {
    for (let jiaoziRestock = 0; jiaoziRestock <= totalRestock; jiaoziRestock++) {
      const tiemengRestock = totalRestock - jiaoziRestock;
      const jiaoziRoute = findBestCurrencyIncomeRoute(goodsData, [cityName], [wulinyuanCityName], jiaoziRestock);
      if (!jiaoziRoute) {
        continue;
      }
      for (const returnBargainOption of getWulinyuanReturnBargainOptions()) {
        const tiemengRoute = findBestCurrencyIncomeRoute(goodsData, [wulinyuanCityName], [cityName], tiemengRestock, returnBargainOption.bargain, returnBargainOption.name);
        if (!tiemengRoute) {
          continue;
        }
        const totalFatigue = jiaoziRoute.fatigue + tiemengRoute.fatigue;
        const combinedRestock = jiaoziRoute.restock + tiemengRoute.restock;
        // 整趟往返的货币净变化：卖旧货得交子，买武林货花交子；反向同理。
        const jiaoziNetProfit = jiaoziRoute.profit - tiemengRoute.cost;
        const tiemengNetProfit = tiemengRoute.profit - jiaoziRoute.cost;
        if (jiaoziNetProfit <= 0 || tiemengNetProfit <= 0) {
          continue;
        }
        const jiaoziGeneralProfitIndex = calculateGeneralProfitIndex(jiaoziNetProfit, totalFatigue, combinedRestock);
        const tiemengGeneralProfitIndex = calculateGeneralProfitIndex(tiemengNetProfit, totalFatigue, combinedRestock);
        const totalGeneralProfitIndex = jiaoziGeneralProfitIndex + tiemengGeneralProfitIndex;
        // 0=总和优先，1=交子优先，2=铁盟币优先；平手时再看副指标和净收益。
        const primary = mode === "mixed-total-first" ? totalGeneralProfitIndex : mode === "mixed-tiemeng-first" ? tiemengGeneralProfitIndex : jiaoziGeneralProfitIndex;
        const secondary = mode === "mixed-tiemeng-first" ? jiaoziGeneralProfitIndex : tiemengGeneralProfitIndex;
        const primaryProfit = mode === "mixed-total-first" ? jiaoziNetProfit + tiemengNetProfit : mode === "mixed-tiemeng-first" ? tiemengNetProfit : jiaoziNetProfit;
        const secondaryProfit = mode === "mixed-tiemeng-first" ? jiaoziNetProfit : tiemengNetProfit;
        if (!best || primary > best.primary || primary === best.primary && secondary > best.secondary || primary === best.primary && secondary === best.secondary && primaryProfit > best.primaryProfit || primary === best.primary && secondary === best.secondary && primaryProfit === best.primaryProfit && secondaryProfit > best.secondaryProfit) {
          best = {
            cityName,
            jiaoziRoute,
            tiemengRoute,
            returnBargainLabel: returnBargainOption.name,
            jiaoziNetProfit,
            tiemengNetProfit,
            jiaoziGeneralProfitIndex,
            tiemengGeneralProfitIndex,
            primary,
            secondary,
            primaryProfit,
            secondaryProfit,
            totalGeneralProfitIndex,
          };
        }
      }
    }
  }
  return best;
}

function getSpecialCurrencyOutputTitle(market: SpecialCurrencyMarketConfig, mode: MixedCurrencyMarketMode, firstOnly = false) {
  if (mode === "jiaozi-only") {
    return firstOnly ? `${market.currencyName}往返跑商行情第一名——仅考虑${market.currencyName}` : `${market.currencyName}往返跑商行情——仅考虑${market.currencyName}`;
  }
  if (mode === "mixed-total-first") {
    return firstOnly ? `${market.currencyName}往返跑商行情第一名——总和优先` : `${market.currencyName}往返跑商行情——总和优先`;
  }
  if (mode === "mixed-jiaozi-first") {
    return firstOnly ? `${market.currencyName}往返跑商行情第一名——${market.currencyName}优先` : `${market.currencyName}往返跑商行情——${market.currencyName}优先`;
  }
  return firstOnly ? `${market.currencyName}往返跑商行情第一名——${market.baseCurrencyName}优先` : `${market.currencyName}往返跑商行情——${market.baseCurrencyName}优先`;
}

function getWulinyuanOutputTitle(mode: MixedCurrencyMarketMode, firstOnly = false) {
  return getSpecialCurrencyOutputTitle(jiaoziMarketConfig, mode, firstOnly);
}

function getSpecialCurrencyDetailCommandHint(market: SpecialCurrencyMarketConfig, mode: MixedCurrencyMarketMode) {
  if (mode === "jiaozi-only") {
    return `具体排行请使用指令 详细行情 ${market.currencyName} 查看`;
  }
  if (mode === "mixed-total-first") {
    return `具体排行请使用指令 详细行情 ${market.currencyName} 0 查看`;
  }
  if (mode === "mixed-jiaozi-first") {
    return `具体排行请使用指令 详细行情 ${market.currencyName} 1 查看`;
  }
  return `具体排行请使用指令 详细行情 ${market.currencyName} 2 查看`;
}

function getWulinyuanDetailCommandHint(mode: MixedCurrencyMarketMode) {
  return getSpecialCurrencyDetailCommandHint(jiaoziMarketConfig, mode);
}

function getXiuwuDetailCommandHint() {
  return `具体排行请使用指令 详细行情 ${xiuwuCommandName} 查看`;
}

function formatWulinyuanPairBargainLabel(pair) {
  // 去程和回程都抬砍时沿用旧行情的简写，避免输出变得啰嗦。
  if (pair?.jiaoziRoute?.bargainLabel === "抬砍" && pair?.returnBargainLabel === "回程抬砍") {
    return "全抬砍";
  }
  return `去程${pair.jiaoziRoute.bargainLabel} ${pair.returnBargainLabel}`;
}

function getWulinyuanRouteOutput(goodsData: GetPricesProducts, mode: MixedCurrencyMarketMode, options: { candidateCities?: string[], titlePrefix?: string, shortTitle?: string, detailHint?: string, emptyText?: string } = {}) {
  if (!goodsData || Object.keys(goodsData).length === 0) {
    const emptyText = options.emptyText ?? "武林源行情暂无数据";
    return { output: emptyText, shortOutput: emptyText };
  }
  const config = getWulinyuanPlayerConfig();
  const candidateCities = options.candidateCities ?? cityList;
  const lines = [];
  let best = null;
  for (let restock = 1; restock <= wulinyuanMaxRestock; restock++) {
    if (mode === "jiaozi-only") {
      // 仅交子模式只保留作调试对照，正式入口使用三种往返模式。
      const jiaoziRoute = findBestCurrencyIncomeRoute(goodsData, candidateCities, [wulinyuanCityName], restock);
      if (!jiaoziRoute) {
        continue;
      }
      if (!best || jiaoziRoute.generalProfitIndex > best.primary) {
        best = { primary: jiaoziRoute.generalProfitIndex, secondary: 0, lineIndex: lines.length };
      }
      lines.push(`${restock}书路线 ${jiaoziMarketConfig.currencyName}综合参考利润 ${jiaoziRoute.generalProfitIndex} ${jiaoziRoute.restock}+0 全抬砍 ${jiaoziRoute.fromCity} 到 ${wulinyuanCityName}`);
    } else {
      const pair = findBestWulinyuanPair(goodsData, restock, mode, candidateCities);
      if (!pair) {
        continue;
      }
      if (!best || pair.primary > best.primary || pair.primary === best.primary && pair.secondary > best.secondary) {
        best = { primary: pair.primary, secondary: pair.secondary, lineIndex: lines.length };
      }
      lines.push(`${restock}书路线 总和综合参考利润 ${pair.totalGeneralProfitIndex} ${jiaoziMarketConfig.currencyName}综合参考利润 ${pair.jiaoziGeneralProfitIndex} ${jiaoziMarketConfig.baseCurrencyName}综合参考利润 ${pair.tiemengGeneralProfitIndex} ${pair.jiaoziRoute.restock}+${pair.tiemengRoute.restock} ${formatWulinyuanPairBargainLabel(pair)} ${pair.cityName} 往返 ${wulinyuanCityName}`);
    }
  }
  if (lines.length === 0) {
    const emptyText = options.emptyText ?? "武林源行情暂无可用路线";
    return { output: emptyText, shortOutput: emptyText };
  }
  const topLine = lines[best?.lineIndex ?? 0];
  const title = options.titlePrefix ?? getWulinyuanOutputTitle(mode);
  const shortTitle = options.shortTitle ?? getWulinyuanOutputTitle(mode, true);
  const detailHint = options.detailHint ?? getWulinyuanDetailCommandHint(mode);
  return {
    output: `${title} 满抬砍 满声望 满共振 1136货仓\n` + lines.join("\n"),
    shortOutput: `${shortTitle}\n\n${topLine}\n\n${detailHint}`,
  };
}

function getXiuwuRouteOutput(goodsData: GetPricesProducts) {
  // 修武固定只看修格里城和武林源之间的往返，其余计算公式沿用交子总和优先逻辑。
  return getWulinyuanRouteOutput(goodsData, "mixed-total-first", {
    candidateCities: [xiuwuCityName],
    titlePrefix: `${xiuwuCommandName}往返跑商行情——总和优先`,
    shortTitle: `${xiuwuCommandName}往返跑商行情第一名——总和优先`,
    detailHint: getXiuwuDetailCommandHint(),
    emptyText: `${xiuwuCommandName}行情暂无可用路线`,
  });
}

function getXiuwuMarketCommandOutput(content: string, detailMode: boolean) {
  const command = toSimplified(content);
  if (!isSpecialCurrencyMarketEnabled(jiaoziMarketConfig) || !command.includes(xiuwuCommandName)) {
    return null;
  }
  return detailMode ? xiuwu_output_str : xiuwu_short_output_str;
}

function getWulinyuanMarketCommandOutput(content: string, detailMode: boolean) {
  const command = toSimplified(content);
  if (!isSpecialCurrencyMarketEnabled(jiaoziMarketConfig) || !specialMarketMatchesCommand(jiaoziMarketConfig, command)) {
    return null;
  }

  // 交子0=总和优先，交子1=交子优先，交子2=铁盟币优先；不写数字默认总和优先。
  if (command.includes("0")) {
    return detailMode ? mixed_total_first_output_str : mixed_total_first_short_output_str;
  }
  if (command.includes("1")) {
    return detailMode ? mixed_jiaozi_first_output_str : mixed_jiaozi_first_short_output_str;
  }
  if (command.includes("2")) {
    return detailMode ? mixed_tiemeng_first_output_str : mixed_tiemeng_first_short_output_str;
  }

  if (command.includes(jiaoziMarketConfig.baseCurrencyName.slice(0, 2))) {
    const baseCurrencyIndex = command.indexOf(jiaoziMarketConfig.baseCurrencyName.slice(0, 2));
    const specialCurrencyIndex = command.indexOf(jiaoziMarketConfig.currencyName);
    const tiemengFirst = command.includes(`${jiaoziMarketConfig.baseCurrencyName.slice(0, 2)}优先`) || command.includes(`${jiaoziMarketConfig.baseCurrencyName}优先`) || baseCurrencyIndex >= 0 && (specialCurrencyIndex < 0 || baseCurrencyIndex < specialCurrencyIndex);
    if (tiemengFirst) {
      return detailMode ? mixed_tiemeng_first_output_str : mixed_tiemeng_first_short_output_str;
    }
    return detailMode ? mixed_jiaozi_first_output_str : mixed_jiaozi_first_short_output_str;
  }

  return detailMode ? mixed_total_first_output_str : mixed_total_first_short_output_str;
}

function getSpecialCurrencyShortcutOutput(market: SpecialCurrencyMarketConfig, mode: ShortcutMode) {
  // 简写入口只返回短行情，避免和旧的“当前行情”详细入口混在一起。
  if (mode === "0") {
    return `${mixed_total_first_short_output_str}\n\n其他优先级请使用 ${market.currencyName} 或 ${market.currencyName}2 查看`;
  }
  if (mode === "2") {
    return `${mixed_tiemeng_first_short_output_str}\n\n其他优先级请使用 ${market.currencyName} 或 ${market.currencyName}0 查看`;
  }
  return `${mixed_jiaozi_first_short_output_str}\n\n其他优先级请使用 ${market.currencyName}0 或 ${market.currencyName}2 查看`;
}

function getWulinyuanShortcutOutput(mode: ShortcutMode) {
  return getSpecialCurrencyShortcutOutput(jiaoziMarketConfig, mode);
}

function getSpecialCurrencySellPriceLine(market: SpecialCurrencyMarketConfig, goodsName: string, goodsData: GetPricesProducts) {
  if (!isSpecialCurrencyMarketEnabled(market)) {
    return "";
  }
  // 商品价格查询单独补充武林源售价，不把武林源混入旧行情数据。
  const sellData = goodsData?.[goodsName]?.sell?.[market.cityName];
  if (!sellData?.price) {
    return "";
  }
  const trend = sellData.variation + "%";
  const trendUpdown = sellData.trend === "up" ? "↑" : "↓";
  const time = intervalTime(sellData.time);
  return `${market.cityName} ${trend}${trendUpdown} 时间 ${time} 售价 ${formatSpecialCurrencyPrice(sellData.price, market)}\n`;
}

function getWulinyuanSellPriceLine(goodsName: string) {
  return getSpecialCurrencySellPriceLine(jiaoziMarketConfig, goodsName, responseDataJiaozi);
}

function getSpecialCurrencyBuyPriceLine(market: SpecialCurrencyMarketConfig, goodsName: string, goodsData: GetPricesProducts) {
  if (!isSpecialCurrencyMarketEnabled(market)) {
    return "";
  }
  // 查询武林源出售商品时同样只读交子缓存，避免污染旧城市价格表。
  const buyData = goodsData?.[goodsName]?.buy?.[market.cityName];
  if (!buyData?.price) {
    return "";
  }
  const trend = buyData.variation + "%";
  const trendUpdown = buyData.trend === "up" ? "↑" : "↓";
  const time = intervalTime(buyData.time);
  return `${goodsName} ${trend}${trendUpdown} 时间 ${time} ${formatSpecialCurrencyPrice(buyData.price, market)}\n`;
}

function getWulinyuanBuyPriceLine(goodsName: string) {
  return getSpecialCurrencyBuyPriceLine(jiaoziMarketConfig, goodsName, responseDataJiaozi);
}

function getSpecialCurrencyCityPriceOutput(market: SpecialCurrencyMarketConfig, item: string, goodsData: GetPricesProducts) {
  if (!isSpecialCurrencyMarketEnabled(market)) {
    return "";
  }
  // 只在明确查询武林源城市时接管城市查询，不影响旧 cityItemList。
  if (!specialMarketMatchesCity(market, item)) {
    return "";
  }
  const goodsLines = Object.keys(goodsData ?? {})
    .map((goodsName) => getSpecialCurrencyBuyPriceLine(market, goodsName, goodsData))
    .filter((line) => line !== "");
  if (goodsLines.length === 0) {
    return `查询到城市${market.cityName}\n\n暂无${market.cityName}商品价格数据。`;
  }
  return `查询到城市${market.cityName}\n\n${goodsLines.join("")}`;
}

function getWulinyuanCityPriceOutput(item: string) {
  return getSpecialCurrencyCityPriceOutput(jiaoziMarketConfig, item, responseDataJiaozi);
}

function getWulinyuanReturnDebugLines(goodsData: GetPricesProducts) {
  // 调试用：确认武林源回程是否被价格、声望、疲劳或税后收入筛掉。
  const config = getWulinyuanPlayerConfig();
  const stats = {
    routeChecks: 0,
    missingBuyPrestige: 0,
    missingSellPrestige: 0,
    missingFatigue: 0,
    missingProduct: 0,
    craftProduct: 0,
    lockedProduct: 0,
    missingBuyPrice: 0,
    missingSellPrice: 0,
    missingBuyLot: 0,
    nonPositiveIncome: 0,
    usableCandidates: 0,
  };
  const wulinyuanBuyProducts = Object.keys(goodsData).filter((goodsName) => !!goodsData[goodsName]?.buy?.[wulinyuanCityName]?.price);
  const sampleProducts = wulinyuanBuyProducts.slice(0, 8).map((goodsName) => {
    const product = products_default.find((it) => it.name === goodsName) as any;
    const dataSellCities = cityList.filter((cityName) => !!goodsData[goodsName]?.sell?.[cityName]?.price).length;
    const staticSellCities = cityList.filter((cityName) => !!product?.sellPrices?.[cityName]).length;
    return `${goodsName} lot${product?.buyLot?.[wulinyuanCityName] ?? 0} 缓存卖${dataSellCities} 基础卖${staticSellCities}`;
  });

  const fromCityMaster = CITY_BELONGS_TO[wulinyuanCityName] ?? wulinyuanCityName;
  const buyPrestige = PRESTIGES.find((p) => p.level === config.prestige[fromCityMaster]);
  const resonanceSkillTaxCutPercent = getResonanceSkillTaxCutPercent(config.roles, wulinyuanCityName as any);
  for (const toCity of cityList) {
    stats.routeChecks++;
    if (!buyPrestige) {
      stats.missingBuyPrestige++;
      continue;
    }
    const toCityMaster = CITY_BELONGS_TO[toCity] ?? toCity;
    const sellPrestige = PRESTIGES.find((p) => p.level === config.prestige[toCityMaster]);
    if (!sellPrestige) {
      stats.missingSellPrestige++;
      continue;
    }
    const fatigue = findFatigue(wulinyuanCityName, toCity, config.roles) ?? 0;
    if (!fatigue) {
      stats.missingFatigue++;
      continue;
    }
    for (const goodsName of wulinyuanBuyProducts) {
      const product = products_default.find((it) => it.name === goodsName) as any;
      if (!product) {
        stats.missingProduct++;
        continue;
      }
      if (product.type === "Craft") {
        stats.craftProduct++;
        continue;
      }
      if (config.productUnlockStatus?.[goodsName] === false) {
        stats.lockedProduct++;
        continue;
      }
      const buyData = goodsData[goodsName]?.buy?.[wulinyuanCityName];
      const sellData = goodsData[goodsName]?.sell?.[toCity];
      if (!buyData?.price) {
        stats.missingBuyPrice++;
        continue;
      }
      if (!sellData?.price) {
        stats.missingSellPrice++;
        continue;
      }
      const buyLotBase = product.buyLot?.[wulinyuanCityName] ?? 0;
      if (!buyLotBase) {
        stats.missingBuyLot++;
        continue;
      }
      const raise = config.bargain.disabled ? 0 : config.bargain.raisePercent ?? 0;
      const sellPrice = Math.round(sellData.price * (1 + raise / 100));
      let sellTaxRate = sellPrestige.specialTax[toCityMaster] ?? sellPrestige.generalTax;
      sellTaxRate += getGameEventTaxVariation(product, wulinyuanCityName as any, config.events) + resonanceSkillTaxCutPercent;
      const singleIncome = Math.round(sellPrice * (1 - sellTaxRate));
      if (singleIncome <= 0) {
        stats.nonPositiveIncome++;
        continue;
      }
      stats.usableCandidates++;
    }
  }

  return [
    `回程调试：武林源买价商品${wulinyuanBuyProducts.length}`,
    `回程商品样例：${sampleProducts.join("；") || "无"}`,
    `回程逐关：城市${stats.routeChecks} 无买声望${stats.missingBuyPrestige} 无卖声望${stats.missingSellPrestige} 无疲劳${stats.missingFatigue}`,
    `回程逐货：无商品${stats.missingProduct} 制造品${stats.craftProduct} 未解锁${stats.lockedProduct} 无买价${stats.missingBuyPrice} 无卖价${stats.missingSellPrice} 无买量${stats.missingBuyLot} 非正收入${stats.nonPositiveIncome} 可用${stats.usableCandidates}`,
  ];
}

function getWulinyuanRestockPeakDebugLines(goodsData: GetPricesProducts) {
  // 调试用：扫描配置的书数上限，观察综合参考利润何时到达峰值或首次下降。
  const modes = [
    { name: "总和优先", mode: "mixed-total-first" as const },
    { name: `${jiaoziMarketConfig.currencyName}优先`, mode: "mixed-jiaozi-first" as const },
    { name: `${jiaoziMarketConfig.baseCurrencyName}优先`, mode: "mixed-tiemeng-first" as const },
  ];
  return modes.map(({ name, mode }) => {
    let peak = null;
    let firstDrop = null;
    let prev = null;
    for (let restock = 1; restock <= wulinyuanMaxRestock; restock++) {
      const pair = findBestWulinyuanPair(goodsData, restock, mode);
      if (!pair) {
        continue;
      }
      const value = mode === "mixed-total-first" ? pair.totalGeneralProfitIndex : mode === "mixed-jiaozi-first" ? pair.jiaoziGeneralProfitIndex : pair.tiemengGeneralProfitIndex;
      if (!peak || value > peak.value) {
        peak = { restock, value, pair };
      }
      if (!firstDrop && prev && value < prev.value) {
        firstDrop = { restock, value, prevRestock: prev.restock, prevValue: prev.value };
      }
      prev = { restock, value };
    }
    if (!peak) {
      return `${name}转折：无可用路线`;
    }
    const dropText = firstDrop ? `，首次下降 ${firstDrop.prevRestock}书${firstDrop.prevValue}->${firstDrop.restock}书${firstDrop.value}` : `，${wulinyuanMaxRestock}书内未下降`;
    return `${name}峰值：${peak.restock}书 ${peak.value} ${peak.pair.jiaoziRoute.restock}+${peak.pair.tiemengRoute.restock} ${peak.pair.cityName}${dropText}`;
  });
}

function getCurrencyNameForRoute(fromCity: string, toCity: string, type: "cost" | "income") {
  return getSpecialCurrencyNameForRoute(jiaoziMarketConfig, fromCity, toCity, type);
}

function formatWulinyuanRouteDetail(route) {
  // 调试输出当前最优解的单程细节，方便核对买卖数量和货币流向。
  if (!route?.detail || route.detail.length === 0) {
    return `${route?.fromCity ?? "未知"}->${route?.toCity ?? "未知"} 无详细数据`;
  }
  const costCurrency = getCurrencyNameForRoute(route.fromCity, route.toCity, "cost");
  const incomeCurrency = getCurrencyNameForRoute(route.fromCity, route.toCity, "income");
  const items = route.detail
    .map((detail) => `${detail.productName} 买${detail.lot}个 花费${detail.totalCost}${costCurrency} 卖出${detail.totalIncome}${incomeCurrency}`)
    .join("；");
  const firstDetail = route.detail[0];
  return `${route.fromCity}->${route.toCity} ${route.restock}书 砍${firstDetail.bargainPercent}% 抬${firstDetail.raisePercent}% ${items}`;
}

function getWulinyuanBestRouteDetailDebugLines(goodsData: GetPricesProducts) {
  // 调试用：展示总和优先模式下当前最优往返解的完整两段数据。
  let best = null;
  for (let restock = 1; restock <= wulinyuanMaxRestock; restock++) {
    const pair = findBestWulinyuanPair(goodsData, restock, "mixed-total-first");
    if (!pair) {
      continue;
    }
    if (!best || pair.totalGeneralProfitIndex > best.totalGeneralProfitIndex) {
      best = pair;
    }
  }
  if (!best) {
    return ["当前最优解详情：无可用路线"];
  }
  return [
    `当前最优解详情：${best.cityName} 往返 ${wulinyuanCityName}`,
    `净收益：${jiaoziMarketConfig.currencyName}${best.jiaoziNetProfit} ${jiaoziMarketConfig.baseCurrencyName}${best.tiemengNetProfit} 总和综合参考利润${best.totalGeneralProfitIndex} ${formatWulinyuanPairBargainLabel(best)}`,
    `去程：${formatWulinyuanRouteDetail(best.jiaoziRoute)}`,
    `回程：${formatWulinyuanRouteDetail(best.tiemengRoute)}`,
  ];
}

function getWulinyuanMarketDebugOutput() {
  // 交子调试/交子测试入口，聚合缓存状态、筛选统计和最优解详情。
  if (!isSpecialCurrencyMarketEnabled(jiaoziMarketConfig)) {
    return `${jiaoziMarketConfig.currencyName}行情已关闭`;
  }
  const goodsData = responseDataJiaozi;
  if (!goodsData || Object.keys(goodsData).length === 0) {
    return [
      "交子行情调试",
      "当前 responseDataJiaozi 为空，说明武林源行情缓存还没有生成。",
      `短行情缓存：${jiaozi_short_output_str}`,
      `总和优先缓存：${mixed_total_first_short_output_str}`,
      `${jiaoziMarketConfig.currencyName}优先缓存：${mixed_jiaozi_first_short_output_str}`,
      `${jiaoziMarketConfig.baseCurrencyName}优先缓存：${mixed_tiemeng_first_short_output_str}`,
    ].join("\n");
  }

  let buyWulinyuanCount = 0;
  let sellWulinyuanCount = 0;
  let roundWulinyuanCount = 0;
  for (const goodsName in goodsData) {
    const goods = goodsData[goodsName];
    const hasBuyWulinyuan = !!goods?.buy?.[wulinyuanCityName]?.price;
    const hasSellWulinyuan = !!goods?.sell?.[wulinyuanCityName]?.price;
    if (hasBuyWulinyuan) buyWulinyuanCount++;
    if (hasSellWulinyuan) sellWulinyuanCount++;
    if (hasBuyWulinyuan && hasSellWulinyuan) roundWulinyuanCount++;
  }

  const restock = 1;
  const jiaoziBest = findBestCurrencyIncomeRoute(goodsData, cityList, [wulinyuanCityName], restock);
  const tiemengBest = findBestCurrencyIncomeRoute(goodsData, [wulinyuanCityName], cityList, restock);
  const cityResults = cityList.map((cityName) => {
    const jiaoziRoute = findBestCurrencyIncomeRoute(goodsData, [cityName], [wulinyuanCityName], restock);
    const tiemengRoute = findBestCurrencyIncomeRoute(goodsData, [wulinyuanCityName], [cityName], restock);
    return {
      cityName,
      jiaozi: jiaoziRoute?.generalProfitIndex ?? 0,
      tiemeng: tiemengRoute?.generalProfitIndex ?? 0,
      paired: !!jiaoziRoute && !!tiemengRoute,
    };
  });
  const pairedCities = cityResults.filter((item) => item.paired);
  const topCities = cityResults
    .filter((item) => item.jiaozi > 0 || item.tiemeng > 0)
    .sort((a, b) => (b.jiaozi + b.tiemeng) - (a.jiaozi + a.tiemeng))
    .slice(0, 10)
    .map((item) => `${item.cityName} ${jiaoziMarketConfig.currencyName}${item.jiaozi} ${jiaoziMarketConfig.baseCurrencyName}${item.tiemeng}${item.paired ? " 可往返" : ""}`);

  return [
    "交子行情调试",
    `商品总数：${Object.keys(goodsData).length}`,
    `武林源出售商品：${buyWulinyuanCount}`,
    `武林源收购商品：${sellWulinyuanCount}`,
    `武林源同时买卖商品：${roundWulinyuanCount}`,
    ...getWulinyuanReturnDebugLines(goodsData),
    ...getWulinyuanRestockPeakDebugLines(goodsData),
    ...getWulinyuanBestRouteDetailDebugLines(goodsData),
    `1书最佳${jiaoziMarketConfig.currencyName}收入：${jiaoziBest ? `${jiaoziBest.fromCity}->${jiaoziBest.toCity} ${jiaoziBest.generalProfitIndex}` : "无"}`,
    `1书最佳${jiaoziMarketConfig.baseCurrencyName}收入：${tiemengBest ? `${tiemengBest.fromCity}->${tiemengBest.toCity} ${tiemengBest.generalProfitIndex}` : "无"}`,
    `1书可往返城市数：${pairedCities.length}`,
    topCities.length ? `候选城市：\n${topCities.join("\n")}` : "候选城市：无",
    `短行情缓存：${jiaozi_short_output_str}`,
    `总和优先缓存：${mixed_total_first_short_output_str}`,
    `${jiaoziMarketConfig.currencyName}优先缓存：${mixed_jiaozi_first_short_output_str}`,
    `${jiaoziMarketConfig.baseCurrencyName}优先缓存：${mixed_tiemeng_first_short_output_str}`,
  ].join("\n");
}

function getWulinyuanMarketDebugOutputParts() {
  // 分段发送调试信息，避免单条消息过长，也方便逐段查看候选和缓存。
  const output = getWulinyuanMarketDebugOutput();
  if (!output.includes("候选城市：") || !output.includes("短行情缓存：")) {
    return [output];
  }
  const [beforeCandidates, afterCandidatesMark] = output.split("候选城市：\n");
  const [candidateText, cacheText] = afterCandidatesMark.split("\n短行情缓存：");
  const beforeLines = beforeCandidates.trimEnd().split("\n");
  const bestRouteIndex = beforeLines.findIndex((line) => line.startsWith("当前最优解详情："));
  const bestIncomeIndex = beforeLines.findIndex((line) => line.startsWith("1书最佳"));
  const firstPart = bestRouteIndex === -1 ? beforeLines : beforeLines.slice(0, bestRouteIndex);
  const secondPart = bestRouteIndex === -1 ? [] : beforeLines.slice(bestRouteIndex, bestIncomeIndex === -1 ? beforeLines.length : bestIncomeIndex);
  const thirdPrefix = bestIncomeIndex === -1 ? [] : beforeLines.slice(bestIncomeIndex);
  return [
    firstPart.join("\n"),
    secondPart.join("\n"),
    [...thirdPrefix, `候选城市：\n${candidateText}`].join("\n"),
    `短行情缓存：${cacheText}`,
  ].filter((part) => part.trim() !== "");
}

function waitDebugOutputDelay(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWulinyuanMarketDebugOutput(session) {
  const parts = getWulinyuanMarketDebugOutputParts();
  for (let i = 0; i < parts.length; i++) {
    const prefix = i === 0 ? h("quote", { id: session.event.message.id }) : "";
    await session.send(prefix + parts[i]);
    if (i < parts.length - 1) {
      await waitDebugOutputDelay();
    }
  }
}

function registerSpecialCurrencyCommands(ctx: Context, market: SpecialCurrencyMarketConfig) {
  if (!isSpecialCurrencyMarketEnabled(market)) {
    return;
  }
  // 特殊货币指令统一注册，后续新增货币只需要扩展配置和输出缓存。
  ctx.command(`${market.currencyName}调试`)
  .action(async ({ session }) => {
    await sendWulinyuanMarketDebugOutput(session);
    });
  ctx.command(`${market.currencyName}测试`)
  .action(async ({ session }) => {
    await sendWulinyuanMarketDebugOutput(session);
    });
  ctx.command(market.currencyName)
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + getWulinyuanShortcutOutput("1"));
    });
  ctx.command(`${market.currencyName}0`)
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + getWulinyuanShortcutOutput("0"));
    });
  ctx.command(`${market.currencyName}1`)
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + getWulinyuanShortcutOutput("1"));
    });
  ctx.command(`${market.currencyName}2`)
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + getWulinyuanShortcutOutput("2"));
    });
}

function isAllowedSpecialCurrencyMessage(content: string) {
  const command = toSimplified(content).trim();
  if (command === xiuwuCommandName || command.includes(`${xiuwuCommandName}`)) {
    return true;
  }
  return getEnabledSpecialCurrencyMarkets().some((market) =>
    command === market.currencyName ||
    command.includes(`${market.currencyName}调试`) ||
    command.includes(`${market.currencyName}测试`) ||
    command.includes(`${market.currencyName}0`) ||
    command.includes(`${market.currencyName}1`) ||
    command.includes(`${market.currencyName}2`)
  );
}

function get_reco(maxRestock,onegraphBuyCombinationsGo,onegraphBuyCombinationsRt,CITIES){
  const results: OnegraphRecommendations = {};
  for (const fromCity of CITIES) {
    results[fromCity] = {};
    for (const toCity of CITIES) {
      if (fromCity === toCity) continue;
      let reco = getOneGraphRecommendation(maxRestock, false, fromCity, toCity, onegraphBuyCombinationsGo);
      if (!reco || reco.length === 0) continue;
      const simpleGo = reco[0];
      reco = getOneGraphRecommendation(
        maxRestock,
        true,
        fromCity,
        toCity,
        onegraphBuyCombinationsGo,
        onegraphBuyCombinationsRt
      );
      if (!reco || reco.length !== 2) continue;
      //console.log(reco)
      const goAndReturn = reco;
      const goAndRtProfit = goAndReturn.reduce((acc, cur) => acc + cur.profit, 0);
      const goAndRtFatigue = goAndReturn[0].fatigue + goAndReturn[1].fatigue;
      const goAndRtProfitPerFatigue = goAndRtFatigue > 0 ? Math.round(goAndRtProfit / goAndRtFatigue) : 0;
      const goAndRtRestockCount = goAndReturn[0].restock + goAndReturn[1].restock;
      const goAndRtGeneralProfitIndex = calculateGeneralProfitIndex(
        goAndRtProfit,
        goAndRtFatigue,
        goAndRtRestockCount
      );
      const goAndReturnTotal = {
        combinations: [],
        profit: goAndRtProfit,
        restock: goAndRtRestockCount,
        fatigue: goAndRtFatigue,
        profitPerFatigue: goAndRtProfitPerFatigue,
        generalProfitIndex: goAndRtGeneralProfitIndex,
        usedLot: -1,
        lastNotWastingRestock: -1
      };
      results[fromCity][toCity] = {
        simpleGo,
        goAndReturn,
        goAndReturnTotal
      };
    }
  }
  return results
}

function get_topProfits(onegraphRecommendations){
  let goProfits: OnegraphTopProfitItem[] = [];
  let goAndReturnProfits: OnegraphTopProfitItem[] = [];
  for (const fromCity in onegraphRecommendations) {
    for (const toCity in onegraphRecommendations[fromCity]) {
      const reco = onegraphRecommendations[fromCity][toCity];
      if (!reco || !reco.simpleGo || reco.goAndReturn?.length !== 2) continue;
      goProfits.push({
        profit: reco.simpleGo.profit,
        profitPerFatigue: reco.simpleGo.profitPerFatigue,
        generalProfitIndex: reco.simpleGo.generalProfitIndex,
        reco,
        fromCity,
        toCity,
      });

      goAndReturnProfits.push({
        profit: reco.goAndReturnTotal.profit,
        profitPerFatigue: reco.goAndReturnTotal.profitPerFatigue,
        generalProfitIndex: reco.goAndReturnTotal.generalProfitIndex,
        reco,
        fromCity,
        toCity,
      });
    }
  }
  goProfits = [...new Set(goProfits)].sort((a, b) => b.profit - a.profit);
  goAndReturnProfits = [...new Set(goAndReturnProfits)].sort((a, b) => b.profit - a.profit);

  // remove same go and return route:
  // 2 items has the same profit, and the one's fromCity and toCity is the reverse of the other,
  // this happens when the go bargain config is the same as the return bargain config
  goAndReturnProfits = goAndReturnProfits.filter((item) => {
    // only need to filter on half of the list
    if (item.fromCity < item.toCity) {
      return true;
    }

    const reverseItem = goAndReturnProfits.find(
      (i) => i.profit === item.profit && i.fromCity === item.toCity && i.toCity === item.fromCity
    );
    return !reverseItem;
  });

  const byProfit = { go: [...goProfits], goAndReturn: [...goAndReturnProfits] };
  //console.log(byProfit)
  const byProfitPerFatigue = {
    go: [...goProfits].sort((a, b) => b.profitPerFatigue - a.profitPerFatigue),
    goAndReturn: [...goAndReturnProfits].sort((a, b) => b.profitPerFatigue - a.profitPerFatigue),
  };

  const byGeneralProfitIndex = {
    go: [...goProfits].sort((a, b) => b.generalProfitIndex - a.generalProfitIndex),
    goAndReturn: [...goAndReturnProfits].sort((a, b) => b.generalProfitIndex - a.generalProfitIndex),
  };

  const topProfits: OnegraphTopProfit = {byProfit,byProfitPerFatigue,byGeneralProfitIndex};

  return topProfits
}

function get_generalProfitIndex(maxRestock, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES){

  const results = get_reco(maxRestock,onegraphBuyCombinationsGo,onegraphBuyCombinationsRt,CITIES)
  const resultsNoReturnBargain = get_reco(maxRestock,onegraphBuyCombinationsGo,onegraphBuyCombinationsRtNoBargain,CITIES)

  const onegraphRecommendations = results
  const onegraphRecommendationsNoReaturnBargain = resultsNoReturnBargain

  const topProfits = get_topProfits(onegraphRecommendations)
  
  const topProfitsNoReturnBargain = get_topProfits(onegraphRecommendationsNoReaturnBargain)

  //console.log(topProfits)
  const top_goAndReturn = {
    "maxRestock":maxRestock,
    "fromCity":topProfits['byGeneralProfitIndex']['goAndReturn'][0]['fromCity'],
    "fromCityRestock":topProfits['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][0]['restock'],
    "toCity":topProfits['byGeneralProfitIndex']['goAndReturn'][0]['toCity'],
    "toCityRestock":topProfits['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][1]['restock'],
    "generalProfitIndex":topProfits['byGeneralProfitIndex']['goAndReturn'][0]['generalProfitIndex'],
    "Bargain":"全抬砍",
  }

  const top_goAndNoReturnBargain = {
    "maxRestock":maxRestock,
    "fromCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['fromCity'],
    "fromCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][0]['restock'],
    "toCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['toCity'],
    "toCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][1]['restock'],
    "generalProfitIndex":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['generalProfitIndex'],
    "Bargain":"回程不抬砍"
  }

  let low_top_goAndReturn = {
    "maxRestock":maxRestock,
    "fromCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['fromCity'],
    "fromCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][0]['restock'],
    "toCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['toCity'],
    "toCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][1]['restock'],
    "generalProfitIndex":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['generalProfitIndex'],
    "Bargain":"全抬砍"
  }

  let low_top_goAndNoReturnBargain = {
    "maxRestock":maxRestock,
    "fromCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['fromCity'],
    "fromCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][0]['restock'],
    "toCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['toCity'],
    "toCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['reco']['goAndReturn'][1]['restock'],
    "generalProfitIndex":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][0]['generalProfitIndex'],
    "Bargain":"回程不抬砍"
  }

  for (let low in topProfits['byGeneralProfitIndex']['goAndReturn']){
    if (topProfits['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'] != "海角城" && topProfits['byGeneralProfitIndex']['goAndReturn'][low]['toCity'] != "海角城" && topProfits['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'] != "汇流塔" && topProfits['byGeneralProfitIndex']['goAndReturn'][low]['toCity'] != "汇流塔"){
      low_top_goAndReturn = {
        "maxRestock":maxRestock,
        "fromCity":topProfits['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'],
        "fromCityRestock":topProfits['byGeneralProfitIndex']['goAndReturn'][low]['reco']['goAndReturn'][0]['restock'],
        "toCity":topProfits['byGeneralProfitIndex']['goAndReturn'][low]['toCity'],
        "toCityRestock":topProfits['byGeneralProfitIndex']['goAndReturn'][low]['reco']['goAndReturn'][1]['restock'],
        "generalProfitIndex":topProfits['byGeneralProfitIndex']['goAndReturn'][low]['generalProfitIndex'],
        "Bargain":"全抬砍"
      }
      break
    }
  }

  for (let low in topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn']){
    if (topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'] != "海角城" && topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['toCity'] != "海角城" && topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'] != "汇流塔" && topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['toCity'] != "汇流塔" ){
      low_top_goAndNoReturnBargain = {
        "maxRestock":maxRestock,
        "fromCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['fromCity'],
        "fromCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['reco']['goAndReturn'][0]['restock'],
        "toCity":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['toCity'],
        "toCityRestock":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['reco']['goAndReturn'][1]['restock'],
        "generalProfitIndex":topProfitsNoReturnBargain['byGeneralProfitIndex']['goAndReturn'][low]['generalProfitIndex'],
        "Bargain":"回程不抬砍"
      }
      break
    }
  }

  //console.log(top_goAndReturn)
  //console.log(topProfitsNoReturnBargain)

  const top = top_goAndReturn['generalProfitIndex'] > top_goAndNoReturnBargain['generalProfitIndex'] ? top_goAndReturn : top_goAndNoReturnBargain

  const low_top = low_top_goAndReturn['generalProfitIndex'] > low_top_goAndNoReturnBargain['generalProfitIndex'] ? low_top_goAndReturn : low_top_goAndNoReturnBargain
  //console.log(low_top)
  //console.log(topProfitsNoReturnBargain)


  const top_str = top.maxRestock + "书路线 综合参考利润 " + top['generalProfitIndex'] + " " + top.fromCityRestock + "+" + top.toCityRestock + " " + top.Bargain + " " + top.fromCity + " 往返 " + top.toCity 

  const low_top_str = low_top.maxRestock + "书路线 综合参考利润 " + low_top['generalProfitIndex'] + " " + low_top.fromCityRestock + "+" + low_top.toCityRestock + " " + low_top.Bargain + " " + low_top.fromCity + " 往返 " + low_top.toCity 
  //console.log(low_top)
  //console.log(low_top['generalProfitIndex'])
  //console.log(top_str)
  return {
    top_str:top_str,
    price:top['generalProfitIndex'],
    low_top_str:low_top_str,
    low_price:low_top['generalProfitIndex']
  }
}

var ctx_send

function flagMaxTimer(flag:boolean) {
  send_flag_max = true;
}

function flagBigTimer(flag:boolean){
  if (flag)
    send_flag_big = true
  send_flag_small = true
}

function flagLowBigTimer(flag:boolean){
  if (flag)
    send_flag_low_big = true
  send_flag_low_small = true
}

var sendTimerId1
var sendTimerId2

var sendMaxTimerId;


var sendTimerIdLow1
var sendTimerIdLow2

var smallPrice = 7500
var bigPrice = 7800

var lowSmallPrice = 7000
var lowBigPrice = 7300

export function send_error(str){
  try {
    ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList, str);
  } catch {
  }
}

function send_message(price){
  if (price >= 11360 && send_flag_max && MaxTeamList.length != 0) {
    ctx_send.bots["onebot:" + qqID].broadcast(MaxTeamList, (h('at', { type: "all" })) + "当前有11360+大行情 综合利润" + price + "\n" + output_str);
    send_flag_max = false;
    sendMaxTimerId = setTimeout(flagMaxTimer, 72e5, true);
    console.log("触发超大行情通告，延迟2小时");
  }
  if (price >= bigPrice && send_flag_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "当前行情达到大行情 综合利润" + price + "\n详细请输入 当前行情 查看");
    clearTimeout(sendTimerId2);
    clearTimeout(sendTimerId1);
    send_flag_big = false;
    send_flag_small = false;
    sendTimerId1 = setTimeout(flagBigTimer, 9e5, true);
    console.log("触发大行情通告，延迟15分钟");
  } else if (price >= smallPrice && send_flag_small && send_flag_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "当前行情达到小行情 综合利润" + price + "\n详细请输入 当前行情 查看");
    clearTimeout(sendTimerId2);
    clearTimeout(sendTimerId1);
    send_flag_small = false;
    sendTimerId2 = setTimeout(flagBigTimer, 9e5, false);
    console.log("触发小行情通告，延迟15分钟");
  }
  if (price >= smallPrice && price < bigPrice && !send_flag_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "大行情降级了 目前综合利润" + price + "\n详细请输入 当前行情 查看");
    clearTimeout(sendTimerId2);
    clearTimeout(sendTimerId1);
    send_flag_big = true;
    send_flag_small = false;
    sendTimerId2 = setTimeout(flagBigTimer, 9e5, false);
    console.log("触发大行情降级通告，小行情通告延迟15分钟");
  }
  if (price < smallPrice && !send_flag_small) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "小行情降级了 目前综合利润" + price + "\n详细请输入 当前行情 查看");
    clearTimeout(sendTimerId2);
    clearTimeout(sendTimerId1);
    send_flag_big = true;
    send_flag_small = true;
    console.log("触发小行情降级通告");
  }
}

function send_low_message(price){
  //console.log("whyNotSendMessage")
  //console.log(price)
  if (price >= 11360 && send_flag_max && MaxTeamList.length != 0) {
    ctx_send.bots["onebot:" + qqID].broadcast(MaxTeamList, (h('at', { type: "all" })) + "当前有11360+大行情 综合利润" + price);
    send_flag_max = false;
    sendMaxTimerId = setTimeout(flagMaxTimer, 72e5, true);
    console.log("触发超大行情通告，延迟2小时");
  }
  if (price >= lowBigPrice && send_flag_low_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "当前有非海角城大行情 综合利润" + price + "\n详细请输入 无海行情 查看");
    clearTimeout(sendTimerIdLow2);
    clearTimeout(sendTimerIdLow1);
    send_flag_low_big = false;
    send_flag_low_small = false;
    sendTimerIdLow1 = setTimeout(flagLowBigTimer, 9e5, true);
    console.log("触发非海角城大行情通告，延迟15分钟");
  } else if (price >= lowSmallPrice && send_flag_low_small && send_flag_low_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "当前有非海角城小行情 综合利润" + price + "\n详细请输入 无海行情 查看");
    clearTimeout(sendTimerIdLow2);
    clearTimeout(sendTimerIdLow1);
    send_flag_low_small = false;
    sendTimerIdLow2 = setTimeout(flagLowBigTimer, 9e5, false);
    console.log("触发非海角城小行情通告，延迟15分钟");
  }
  if (price >= lowSmallPrice && price < lowBigPrice && !send_flag_low_big) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "非海角城大行情降级了 目前综合利润" + price + "\n详细请输入 无海行情 查看");
    clearTimeout(sendTimerIdLow2);
    clearTimeout(sendTimerIdLow1);
    send_flag_low_big = true;
    send_flag_low_small = false;
    sendTimerIdLow2 = setTimeout(flagLowBigTimer, 9e5, false);
    console.log("触发非海角城大行情降级通告，小行情通告延迟15分钟");
  }
  if (price < lowSmallPrice && !send_flag_low_small) {
    ctx_send.bots["onebot:" + qqID].broadcast(TeamList, "非海角城小行情降级了 目前综合利润" + price + "\n详细请输入 无海行情 查看");
    clearTimeout(sendTimerIdLow2);
    clearTimeout(sendTimerIdLow1);
    send_flag_low_big = true;
    send_flag_low_small = true;
    console.log("触发非海角城小行情降级通告");
  }
}

function get_max_price() {
  let ItemMaxPrice2 = {};
  for (let i in PRODUCTS) {
    let max_price = {
      "city": "",
      "price": 0
    };
    for (let city in PRODUCTS[i]["sellPrices"]) {
      if (PRODUCTS[i]["sellPrices"][city] > max_price.price) {
        max_price.price = PRODUCTS[i]["sellPrices"][city];
        max_price.city = city;
      }
    }
    max_price.price = Math.round(max_price.price * 1.2);
    ItemMaxPrice2[PRODUCTS[i]["name"]] = max_price;
  }
  return ItemMaxPrice2;
}

var ti;
var tiInterval;
var nextTi = Date.now() / 1136 - 60;
var waitTi = 0;

var tiSteam;
var tiIntervalSteam;
var nextTiSteam = Date.now() / 1136 - 60;
var waitTiSteam = 0;

export async function get_price(){
  if (getDataUrl == "" || getDataUrl == null)
    return;
  if (getDataUrl == "https://reso-online-ddos.soli-reso.com/get_server_trade/") {
    let tiNow = Date.now() / 1e3;
    console.log("官服")
    console.log(tiNow);
    console.log(nextTi);
    if (tiNow < nextTi) {
      intervalID = setTimeout(get_price, 3e4);
      console.log("未达到更新时间");
      return;
    }
    const response = await axios.get(getDataUrl);
    var data;
    data = response.data.server_trade;
    ti = response.data.refresh_time;
    tiInterval = response.data.interval;
    nextTi = ti + tiInterval;
    console.log(nextTi);
    console.log(nextTi * 1e3 - tiNow * 1e3 + 60);
    if (nextTi * 1e3 - tiNow * 1e3 + 60 < 0) {
      if (waitTi < 6e4)
        waitTi = waitTi + 1e4;
      intervalID = setTimeout(get_price, waitTi);
      console.log("数据未刷新，等待时间" + waitTi / 1e3 + "s");
      return;
    } else {
      intervalID = setTimeout(get_price, nextTi * 1e3 - tiNow * 1e3 + 25e3);
      waitTi = 0;
    }
    ItemMaxPrice = get_max_price();
    //console.log(ItemMaxPrice)
    const specialCityList = getSpecialCurrencyCityList();
    responseDataJiaozi = removeProductsWithUnknownBuyCities(convertFirebaseDataToGetPricesDataNew(data, specialCityList, true), specialCityList, defaultProductNames);
    responseData = removeProductsWithUnknownBuyCities(convertFirebaseDataToGetPricesDataNew(data,cityList), cityList, defaultProductNames);

  }

  min = 0
  low_min = 0

  if (getDataUrl == "https://www.resonance-columba.com/api/get-prices") {
    const response = await axios.get(getDataUrl);
    data = response.data.data;
    if (Object.keys(data).length != PRODUCTS.length) {
      if (updataNum == 0) {
        errorNum = 0;
      }
      if (updataNum < 13) {
        updata_columba_data(ctx_send);
      }
      if (updataFlag == false) {
        updataNum = updataNum + 1;
        if (updataNum >= 5) {
          if (updataNum <= 10) {
            errorNum = errorNum + 1;
            console.log("新版本数据源出现错误，正在尝试使用旧版本数据源 尝试次数 " + errorNum);
            if (updataNum == 5)
              try {
                ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList, "新版本数据源出现错误，正在尝试使用旧版本数据源");
              } catch {
              }
          } else {
            console.log("数据源出现严重错误，请通知管理员处理");
            if (updataNum == 11)
              try {
                ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList, "数据源出现严重错误，请通知管理员处理");
              } catch {
              }
          }
          output_str = "数据源出现严重错误，请通知管理员处理";
          low_output_str = "数据源出现严重错误，请通知管理员处理";
          small_output_str = "数据源出现严重错误，请通知管理员处理";
          short_output_str = "数据源出现严重错误，请通知管理员处理";
          jiaozi_output_str = "数据源出现严重错误，请通知管理员处理";
          jiaozi_short_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_total_first_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_total_first_short_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_jiaozi_first_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_jiaozi_first_short_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_tiemeng_first_output_str = "数据源出现严重错误，请通知管理员处理";
          mixed_tiemeng_first_short_output_str = "数据源出现严重错误，请通知管理员处理";
          return;
        }
      } else {
        updataFlag = false;
      }
      console.log("检测到数据源异常，正在尝试更新 次数" + (updataNum + 1).toString());
      if (updataNum == 0)
        try {
          ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList, "检测到数据源异常，正在尝试更新");
        } catch {
        }
      return;
    }
    const specialCityList = getSpecialCurrencyCityList();
    responseDataJiaozi = removeProductsWithUnknownBuyCities(convertFirebaseDataToGetPricesData(data, specialCityList), specialCityList, defaultProductNames);
    responseData = removeProductsWithUnknownBuyCities(convertFirebaseDataToGetPricesData(data), cityList, defaultProductNames);
  }

  //console.log(response)
  //console.log(products_default)
  //console.log(Object.keys(data).length)
  //console.log(products_default.length)
  //console.log(PRODUCTS)

  output_str = "";
  low_output_str = "";
  small_output_str = "";
  short_output_str = "";
  jiaozi_output_str = "";
  jiaozi_short_output_str = "";
  mixed_total_first_output_str = "";
  mixed_total_first_short_output_str = "";
  mixed_jiaozi_first_output_str = "";
  mixed_jiaozi_first_short_output_str = "";
  mixed_tiemeng_first_output_str = "";
  mixed_tiemeng_first_short_output_str = "";

  for (let item in ErrorItemList){
    if (ErrorItemList[item] in responseData)
      responseData[ErrorItemList[item]]['buy'] = {}
    if (responseDataJiaozi && ErrorItemList[item] in responseDataJiaozi)
      responseDataJiaozi[ErrorItemList[item]]['buy'] = {}
  }
  //console.log(responseData)

  const jiaoziMarketOutput = getJiaoziMarketOutput(responseDataJiaozi);
  jiaozi_output_str = jiaoziMarketOutput.output;
  jiaozi_short_output_str = jiaoziMarketOutput.shortOutput;
  const mixedTotalFirstOutput = getMixedCurrencyMarketOutput(responseDataJiaozi, "total");
  mixed_total_first_output_str = mixedTotalFirstOutput.output;
  mixed_total_first_short_output_str = mixedTotalFirstOutput.shortOutput;
  const mixedJiaoziFirstOutput = getMixedCurrencyMarketOutput(responseDataJiaozi, "jiaozi");
  mixed_jiaozi_first_output_str = mixedJiaoziFirstOutput.output;
  mixed_jiaozi_first_short_output_str = mixedJiaoziFirstOutput.shortOutput;
  const mixedTiemengFirstOutput = getMixedCurrencyMarketOutput(responseDataJiaozi, "tiemeng");
  mixed_tiemeng_first_output_str = mixedTiemengFirstOutput.output;
  mixed_tiemeng_first_short_output_str = mixedTiemengFirstOutput.shortOutput;
  const xiuwuOutput = getXiuwuRouteOutput(responseDataJiaozi);
  xiuwu_output_str = xiuwuOutput.output;
  xiuwu_short_output_str = xiuwuOutput.shortOutput;
  for (let qqTeam in ItemSendList) {
    for (let Item in ItemSendList[qqTeam]) {
      if (ItemSendList[qqTeam][Item]["type"] == "buy") {
        for (var i = 0; i < ItemSendList[qqTeam][Item]["city"].length; i++) {
          if (responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] <= ItemSendList[qqTeam][Item]["variation"][i]) {
            if (responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] <= ItemSendList[qqTeam][Item]["flag"][i]) {
              var trend_updown = responseData[Item]["buy"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
              try {
                if (ItemSendList[qqTeam][Item]["send"] == true)
                  ctx_send.bots["onebot:" + qqID].sendMessage(qqTeam, (h("at", { type: "all" })) + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + "购买 " + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown);
                else
                  ctx_send.bots["onebot:" + qqID].sendMessage(qqTeam, ItemSendList[qqTeam][Item]["city"][i] + " " + Item + "购买 " + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown);
              } catch {
              }
              console.log(qqTeam + "通报" + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + "购买 " + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown);
              ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] - 1;
            } else {
              ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] - 1;
            }
          } else {
            ItemSendList[qqTeam][Item]["flag"][i] = ItemSendList[qqTeam][Item]["variation"][i];
          }
        }
      }
      if (ItemSendList[qqTeam][Item]["type"] == "sell") {
        for (var i = 0; i < ItemSendList[qqTeam][Item]["city"].length; i++) {
          let sendStr = "";
          if (ItemSendList[qqTeam][Item]["flag"][i] == 0) {
            ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"];
            ItemSendList[qqTeam][Item]["trend_updown_flag"][i] = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
          }
          if (responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] >= ItemSendList[qqTeam][Item]["variation"][i]) {
            let trend_updown2 = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
            if (responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] > ItemSendList[qqTeam][Item]["flag"][i]) {
              if (ItemSendList[qqTeam][Item]["send"] == true)
                if (ItemSendList[qqTeam][Item]["variation"][i] <= 120 && responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] == 120 || ItemSendList[qqTeam][Item]["variation"][i] > 120 && responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] >= ItemSendList[qqTeam][Item]["variation"][i])
                  sendStr = (h("at", { type: "all" })) + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 涨价了\n" + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2 + " 当前售价 " + Math.round(responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["price"]) + "\n理论最高售价 " + ItemMaxPrice[Item]["city"] + "：" + ItemMaxPrice[Item]["price"];
                else
                  sendStr = ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 涨价了\n" + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2 + " 当前售价 " + Math.round(responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["price"]) + "\n理论最高售价 " + ItemMaxPrice[Item]["city"] + "：" + ItemMaxPrice[Item]["price"];
              else
                sendStr = ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 涨价了\n" + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2 + " 当前售价 " + Math.round(responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["price"]) + "\n理论最高售价 " + ItemMaxPrice[Item]["city"] + "：" + ItemMaxPrice[Item]["price"];
              console.log(qqTeam + "通报" + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 涨价了 " + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2);
              ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"];
              ItemSendList[qqTeam][Item]["trend_updown_flag"][i] = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
            } else {
              if (responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] < ItemSendList[qqTeam][Item]["flag"][i]) {
                sendStr = ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 降价了\n" + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2 + " 当前售价 " + Math.round(responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["price"]) + "\n理论最高售价 " + ItemMaxPrice[Item]["city"] + "：" + ItemMaxPrice[Item]["price"];
                console.log(qqTeam + "通报 " + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 降价了 " + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2);
              }
            }
            ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"];
            ItemSendList[qqTeam][Item]["trend_updown_flag"][i] = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
          } else {
            if (ItemSendList[qqTeam][Item]["flag"][i] >= ItemSendList[qqTeam][Item]["variation"][i]) {
              let trend_updown2 = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
              sendStr = ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 降价了\n" + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2 + " 当前售价 " + Math.round(responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["price"]) + "\n理论最高售价 " + ItemMaxPrice[Item]["city"] + "：" + ItemMaxPrice[Item]["price"];
              console.log(qqTeam + "通报 " + ItemSendList[qqTeam][Item]["city"][i] + " " + Item + " 降价了 " + ItemSendList[qqTeam][Item]["flag"][i] + "%" + ItemSendList[qqTeam][Item]["trend_updown_flag"][i] + "—>" + responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"] + "%" + trend_updown2);
            }
            ItemSendList[qqTeam][Item]["flag"][i] = responseData[Item][ItemSendList[qqTeam][Item]["type"]][ItemSendList[qqTeam][Item]["city"][i]]["variation"];
            ItemSendList[qqTeam][Item]["trend_updown_flag"][i] = responseData[Item]["sell"][ItemSendList[qqTeam][Item]["city"][i]]["trend"] === "up" ? "↑" : "↓";
          }
          if (sendStr != "") {
            console.log(sendStr);
            try {
              ctx_send.bots["onebot:" + qqID].sendMessage(qqTeam, sendStr);
            } catch {
            }
          }
        }
      }
    }
  }

  const onegraphBuyCombinationsGo = calculateOneGraphBuyCombinations(responseData, BotConfig.maxLot, BotConfig.bargain, BotConfig.prestige, BotConfig.roles, BotConfig.productUnlockStatus, BotConfig.events,CITIES);
  const onegraphBuyCombinationsRt = calculateOneGraphBuyCombinations(responseData, BotConfig.maxLot, BotConfig.returnBargain, BotConfig.prestige, BotConfig.roles, BotConfig.productUnlockStatus, BotConfig.events,CITIES);
  const onegraphBuyCombinationsRtNoBargain = calculateOneGraphBuyCombinations(responseData, BotConfig.maxLot, BotConfigNoReturnBargain.returnBargain, BotConfig.prestige, BotConfig.roles, BotConfig.productUnlockStatus, BotConfig.events,CITIES);
  
  //console.log(onegraphBuyCombinationsGo)
  output_str = output_str + "综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1136货仓\n";
  low_output_str = low_output_str + "无海角城版本综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1136货仓\n";
  small_output_str = small_output_str + "综合利润往返跑商行情第一名\n\n";
  //console.log("单票利润往返跑商行情 满抬砍 满声望 满共振 1136货仓")

  let max_price = 0;
  let max_price_str = "";

  var maxRestock_1 = get_generalProfitIndex(1, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  //console.log(maxRestock_1)
  min = maxRestock_1.price > min ? maxRestock_1.price : min;
  low_min = maxRestock_1.low_price > low_min ? maxRestock_1.low_price : low_min;
  if (maxRestock_1.price > max_price) {
    max_price = maxRestock_1.price;
    max_price_str = maxRestock_1.top_str;
  }
  var maxRestock_2 = get_generalProfitIndex(2, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  min = maxRestock_2.price > min ? maxRestock_2.price : min;
  low_min = maxRestock_2.low_price > low_min ? maxRestock_2.low_price : low_min;
  if (maxRestock_2.price > max_price) {
    max_price = maxRestock_2.price;
    max_price_str = maxRestock_2.top_str;
  }
  var maxRestock_3 = get_generalProfitIndex(3, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  min = maxRestock_3.price > min ? maxRestock_3.price : min;
  low_min = maxRestock_3.low_price > low_min ? maxRestock_3.low_price : low_min;
  if (maxRestock_3.price > max_price) {
    max_price = maxRestock_3.price;
    max_price_str = maxRestock_3.top_str;
  }
  var maxRestock_4 = get_generalProfitIndex(4, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  min = maxRestock_4.price > min ? maxRestock_4.price : min;
  low_min = maxRestock_4.low_price > low_min ? maxRestock_4.low_price : low_min;
  if (maxRestock_4.price > max_price) {
    max_price = maxRestock_4.price;
    max_price_str = maxRestock_4.top_str;
  }
  var maxRestock_5 = get_generalProfitIndex(5, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  min = maxRestock_5.price > min ? maxRestock_5.price : min;
  low_min = maxRestock_5.low_price > low_min ? maxRestock_5.low_price : low_min;
  if (maxRestock_5.price > max_price) {
    max_price = maxRestock_5.price;
    max_price_str = maxRestock_5.top_str;
  }
  var maxRestock_6 = get_generalProfitIndex(6, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIES);
  min = maxRestock_6.price > min ? maxRestock_6.price : min;
  low_min = maxRestock_6.low_price > low_min ? maxRestock_6.low_price : low_min;
  if (maxRestock_6.price > max_price) {
    max_price = maxRestock_6.price;
    max_price_str = maxRestock_6.top_str;
  }
  small_output_str = small_output_str + max_price_str + "\n\n具体排行请使用指令 详细行情 查看";
  short_output_str = max_price_str.replace("路线 综合参考利润", "");
  output_str = output_str + maxRestock_1.top_str + "\n";
  output_str = output_str + maxRestock_2.top_str + "\n";
  output_str = output_str + maxRestock_3.top_str + "\n";
  output_str = output_str + maxRestock_4.top_str + "\n";
  output_str = output_str + maxRestock_5.top_str + "\n";
  output_str = output_str + maxRestock_6.top_str;
  low_output_str = low_output_str + maxRestock_1.low_top_str + "\n";
  low_output_str = low_output_str + maxRestock_2.low_top_str + "\n";
  low_output_str = low_output_str + maxRestock_3.low_top_str + "\n";
  low_output_str = low_output_str + maxRestock_4.low_top_str + "\n";
  low_output_str = low_output_str + maxRestock_5.low_top_str + "\n";
  low_output_str = low_output_str + maxRestock_6.low_top_str;
  console.log("行情刷新");
  try{
    send_message(min)
    send_low_message(low_min)
  }
  catch(err) {
    console.log("未能发送信息")
  }
  if (!updataFlag){
    updataFlag = true
    updataNum = 0
    if (errorNum > 0){
      console.log("正在使用旧版本数据源，请检查数据是否正确")
      try{
        ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList,"正在使用旧版本数据源，请检查数据是否正确")
      }
      catch{
      }
    }
    else{
      console.log("数据已更新，请检查数据是否正确")
      try{
        ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList,"数据已更新，请检查数据是否正确")
      }
      catch{
      }
    }
  }

  //console.log(PRODUCTS)
}

export async function get_price_steam(){
  var getDataUrlSteam = "https://jp-prd-rzns.gameduchy.com/get_server_trade/"
  let tiNow = Date.now() / 1e3;
  console.log("日服（STEAM）")
  console.log(tiNow);
  console.log(nextTiSteam);
  if (tiNow < nextTiSteam) {
    intervalIDSteam = setTimeout(get_price_steam, 3e4);
    console.log("未达到更新时间");
    return;
  }
  const response = await axios.get(getDataUrlSteam);
  var data;
  data = response.data.server_trade;
  data = replaceKeysAndValues(data,items_japanese,items_chinese)
  data = replaceKeysAndValues(data,citys_japanese,citys_chinese)
  tiSteam = response.data.refresh_time;
  tiIntervalSteam = response.data.interval;
  nextTiSteam = tiSteam + tiIntervalSteam;
  console.log(nextTiSteam);
  console.log(nextTiSteam * 1e3 - tiNow * 1e3 + 60);
  if (nextTiSteam * 1e3 - tiNow * 1e3 + 60 < 0) {
    if (waitTiSteam < 6e4)
      waitTiSteam = waitTiSteam + 1e4;
    intervalIDSteam = setTimeout(get_price_steam, waitTiSteam);
    console.log("STEAM数据未刷新，等待时间" + waitTiSteam / 1e3 + "s");
  } else {
    intervalIDSteam = setTimeout(get_price_steam, nextTiSteam * 1e3 - tiNow * 1e3 + 25e3);
    waitTiSteam = 0;
  }
  responseDataSteam = removeProductsWithUnknownBuyCities(convertFirebaseDataToGetPricesDataNew(data,cityListSteam), cityListSteam, steamProductNames);


  min = 0
  low_min = 0

  //console.log(response)
  //console.log(products_default)
  //console.log(Object.keys(data).length)
  //console.log(products_default.length)
  //console.log(PRODUCTS)

  output_str_steam = "";
  low_output_str_steam = "";
  small_output_str_steam = "";
  short_output_str_steam = "";

  for (let item in ErrorItemList){
    if (ErrorItemList[item] in responseDataSteam)
      responseDataSteam[ErrorItemList[item]]['buy'] = {}
  }
  //console.log(responseDataSteam)


  const onegraphBuyCombinationsGo = calculateOneGraphBuyCombinations(responseDataSteam, BotConfigSteam.maxLot, BotConfigSteam.bargain, BotConfigSteam.prestige, BotConfigSteam.roles, BotConfigSteam.productUnlockStatus, BotConfigSteam.events,CITIESSTEAM);
  const onegraphBuyCombinationsRt = calculateOneGraphBuyCombinations(responseDataSteam, BotConfigSteam.maxLot, BotConfigSteam.returnBargain, BotConfigSteam.prestige, BotConfigSteam.roles, BotConfigSteam.productUnlockStatus, BotConfigSteam.events,CITIESSTEAM);
  const onegraphBuyCombinationsRtNoBargain = calculateOneGraphBuyCombinations(responseDataSteam, BotConfigSteam.maxLot, BotConfigNoReturnBargainSteam.returnBargain, BotConfigSteam.prestige, BotConfigSteam.roles, BotConfigSteam.productUnlockStatus, BotConfigSteam.events,CITIESSTEAM);
  
  //console.log(onegraphBuyCombinationsGo)
  output_str_steam = output_str_steam + "综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1136货仓\n";
  low_output_str_steam = low_output_str_steam + "无海角城版本综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1136货仓\n";
  small_output_str_steam = small_output_str_steam + "综合利润往返跑商行情第一名\n\n";
  //console.log("单票利润往返跑商行情 满抬砍 满声望 满共振 1136货仓")

  let max_price = 0;
  let max_price_str = "";

  var maxRestock_1 = get_generalProfitIndex(1, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  //console.log(maxRestock_1)
  min = maxRestock_1.price > min ? maxRestock_1.price : min;
  low_min = maxRestock_1.low_price > low_min ? maxRestock_1.low_price : low_min;
  if (maxRestock_1.price > max_price) {
    max_price = maxRestock_1.price;
    max_price_str = maxRestock_1.top_str;
  }
  var maxRestock_2 = get_generalProfitIndex(2, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  min = maxRestock_2.price > min ? maxRestock_2.price : min;
  low_min = maxRestock_2.low_price > low_min ? maxRestock_2.low_price : low_min;
  if (maxRestock_2.price > max_price) {
    max_price = maxRestock_2.price;
    max_price_str = maxRestock_2.top_str;
  }
  var maxRestock_3 = get_generalProfitIndex(3, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  min = maxRestock_3.price > min ? maxRestock_3.price : min;
  low_min = maxRestock_3.low_price > low_min ? maxRestock_3.low_price : low_min;
  if (maxRestock_3.price > max_price) {
    max_price = maxRestock_3.price;
    max_price_str = maxRestock_3.top_str;
  }
  var maxRestock_4 = get_generalProfitIndex(4, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  min = maxRestock_4.price > min ? maxRestock_4.price : min;
  low_min = maxRestock_4.low_price > low_min ? maxRestock_4.low_price : low_min;
  if (maxRestock_4.price > max_price) {
    max_price = maxRestock_4.price;
    max_price_str = maxRestock_4.top_str;
  }
  var maxRestock_5 = get_generalProfitIndex(5, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  min = maxRestock_5.price > min ? maxRestock_5.price : min;
  low_min = maxRestock_5.low_price > low_min ? maxRestock_5.low_price : low_min;
  if (maxRestock_5.price > max_price) {
    max_price = maxRestock_5.price;
    max_price_str = maxRestock_5.top_str;
  }
  var maxRestock_6 = get_generalProfitIndex(6, onegraphBuyCombinationsGo, onegraphBuyCombinationsRt, onegraphBuyCombinationsRtNoBargain,CITIESSTEAM);
  min = maxRestock_6.price > min ? maxRestock_6.price : min;
  low_min = maxRestock_6.low_price > low_min ? maxRestock_6.low_price : low_min;
  if (maxRestock_6.price > max_price) {
    max_price = maxRestock_6.price;
    max_price_str = maxRestock_6.top_str;
  }
  small_output_str_steam = small_output_str_steam + max_price_str + "\n\n具体排行请使用指令 详细行情 查看";
  short_output_str_steam = max_price_str.replace("路线 综合参考利润", "");
  output_str_steam = output_str_steam + maxRestock_1.top_str + "\n";
  output_str_steam = output_str_steam + maxRestock_2.top_str + "\n";
  output_str_steam = output_str_steam + maxRestock_3.top_str + "\n";
  output_str_steam = output_str_steam + maxRestock_4.top_str + "\n";
  output_str_steam = output_str_steam + maxRestock_5.top_str + "\n";
  output_str_steam = output_str_steam + maxRestock_6.top_str;
  low_output_str_steam = low_output_str_steam + maxRestock_1.low_top_str + "\n";
  low_output_str_steam = low_output_str_steam + maxRestock_2.low_top_str + "\n";
  low_output_str_steam = low_output_str_steam + maxRestock_3.low_top_str + "\n";
  low_output_str_steam = low_output_str_steam + maxRestock_4.low_top_str + "\n";
  low_output_str_steam = low_output_str_steam + maxRestock_5.low_top_str + "\n";
  low_output_str_steam = low_output_str_steam + maxRestock_6.low_top_str;
  console.log("行情刷新");
  try{
    send_message(min)
    send_low_message(low_min)
  }
  catch(err) {
    console.log("未能发送信息")
  }
  if (!updataFlag){
    updataFlag = true
    updataNum = 0
    if (errorNum > 0){
      console.log("正在使用旧版本数据源，请检查数据是否正确")
      try{
        ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList,"正在使用旧版本数据源，请检查数据是否正确")
      }
      catch{
      }
    }
    else{
      console.log("数据已更新，请检查数据是否正确")
      try{
        ctx_send.bots["onebot:" + qqID].broadcast(ErrorTeamList,"数据已更新，请检查数据是否正确")
      }
      catch{
      }
    }
  }

  //console.log(PRODUCTS)
}

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  SpecialCurrencyMarketOpen = config.SpecialCurrencyMarketOpen ?? {};
  ctx.on("ready", () => {
    ctx_send = ctx;
    const time = ctx.config.TimerTime * 6e4;
    let SteamOpen: boolean = false;
    smallPrice = ctx.config.SmallPrice;
    if (ctx.config.TeamList.length != 0)
      TeamList = ctx.config.TeamList;
    if (ctx.config.ErrorTeamList.lenth != 0)
      ErrorTeamList = ctx.config.ErrorTeamList;
    if (ctx.config.ErrorItemList.lenth != 0)
      ErrorItemList = ctx.config.ErrorItemList;
    if (ctx.config.MaxTeamList.lenth != 0)
      MaxTeamList = ctx.config.MaxTeamList;
    if (ctx.config.ShortTeamList.lenth != 0)
      ShortTeamList = ctx.config.ShortTeamList;
    if (ctx.config.SteamTeamList.lenth != 0)
      SteamTeamList = ctx.config.SteamTeamList;
    SpecialCurrencyMarketOpen = ctx.config.SpecialCurrencyMarketOpen ?? {};
    SteamOpen = ctx.config.SteamOpen;
    bigPrice = ctx.config.BigPrice;
    lowBigPrice = ctx.config.LowBigPrice;
    lowSmallPrice = ctx.config.LowSmallPrice;
    qqID = ctx.config.QQID;
    getDataUrl = ctx.config.DataUrl;
    console.log("插件启动");
    console.log("行情刷新时间为:", time, "毫秒");
    if (ctx.config.StartUrl != "" && ctx.config.StartUrl != null)
      updata_columba_data(ctx, ctx.config.StartUrl, true, SteamOpen);
    else
      updata_columba_data(ctx, "", true, SteamOpen);
    if (getDataUrl == "https://www.resonance-columba.com/api/get-prices") {
      clearInterval(intervalID);
      intervalID = setInterval(get_price, 6e4);
    }
    //数据改为本地上传 不再读取配置
    //intervalID2 = setInterval(updata_columba_data, 36e5, ctx, "", false);
    ItemSendList = ctx.config.ItemSendList;
    for (let qqTeam in ItemSendList) {
      for (let Item in ItemSendList[qqTeam]) {
        ItemSendList[qqTeam][Item]["flag"] = new Array(ItemSendList[qqTeam][Item]["city"].length).fill(0);
        ItemSendList[qqTeam][Item]["trend_updown_flag"] = new Array(ItemSendList[qqTeam][Item]["city"].length).fill("↑");
      }
    }
  })
  ctx.command("steam行情")
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + output_str_steam);
    });
  registerSpecialCurrencyCommands(ctx, jiaoziMarketConfig);
  ctx.command("修武")
  .action(async ({ session }) => {
    session.send(h("quote", { id: session.event.message.id }) + xiuwu_short_output_str);
    });
  ctx.command("当前行情")
  .action(async ({ session }) => {
    const wulinyuanMarketOutput = getWulinyuanMarketCommandOutput(session.content, false);
    if (wulinyuanMarketOutput) {
      session.send(wulinyuanMarketOutput);
      return;
    }
    if (!isShortTeamRestricted(session))
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(h("quote", { id: session.event.message.id }) + small_output_str_steam);
      else
        session.send(h("quote", { id: session.event.message.id }) + small_output_str);
    else
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(short_output_str_steam);
      else
        session.send(short_output_str);
    });
  ctx.command("无海行情")
  .action(async ({ session }) => {
    if (!isShortTeamRestricted(session) || session.channelId in SteamTeamList)
      session.send(h("quote", { id: session.event.message.id }) + low_output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
    });
  ctx.command("當前行情")
  .action(async ({ session }) => {
    const wulinyuanMarketOutput = getWulinyuanMarketCommandOutput(session.content, false);
    if (wulinyuanMarketOutput) {
      session.send(wulinyuanMarketOutput);
      return;
    }
    if (!isShortTeamRestricted(session))
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(h("quote", { id: session.event.message.id }) + small_output_str_steam);
      else
        session.send(h("quote", { id: session.event.message.id }) + small_output_str);
    else
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(short_output_str_steam);
      else
        session.send(short_output_str);
    });
  ctx.command("無海行情")
  .action(async ({ session }) => {
    if (!isShortTeamRestricted(session) || session.channelId in SteamTeamList)
      session.send(h("quote", { id: session.event.message.id }) + low_output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
    });
  ctx.command("详细行情")
  .action(async ({ session }) => {
    const xiuwuMarketOutput = getXiuwuMarketCommandOutput(session.content, true);
    if (xiuwuMarketOutput) {
      if (!isShortTeamRestricted(session))
        session.send(h("quote", { id: session.event.message.id }) + xiuwuMarketOutput);
      else
        session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群 957035373\n行情通知群 756406126");
      return;
    }
    const wulinyuanMarketOutput = getWulinyuanMarketCommandOutput(session.content, true);
    if (wulinyuanMarketOutput) {
      if (!isShortTeamRestricted(session))
        session.send(h("quote", { id: session.event.message.id }) + wulinyuanMarketOutput);
      else
        session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
      return;
    }
    if (!isShortTeamRestricted(session))
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(h("quote", { id: session.event.message.id }) + output_str_steam);
      else
        session.send(h("quote", { id: session.event.message.id }) + output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
  });
  ctx.command("詳細行情")
  .action(async ({ session }) => {
    const xiuwuMarketOutput = getXiuwuMarketCommandOutput(session.content, true);
    if (xiuwuMarketOutput) {
      if (!isShortTeamRestricted(session))
        session.send(h("quote", { id: session.event.message.id }) + xiuwuMarketOutput);
      else
        session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群 957035373\n行情通知群 756406126");
      return;
    }
    const wulinyuanMarketOutput = getWulinyuanMarketCommandOutput(session.content, true);
    if (wulinyuanMarketOutput) {
      if (!isShortTeamRestricted(session))
        session.send(h("quote", { id: session.event.message.id }) + wulinyuanMarketOutput);
      else
        session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
      return;
    }
    if (!isShortTeamRestricted(session))
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(h("quote", { id: session.event.message.id }) + output_str_steam);
      else
        session.send(h("quote", { id: session.event.message.id }) + output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
  });
  ctx.middleware(async (session, next) => {
    if ((session.content.includes('时价') && session.content[0] == "时" ) || (session.content.includes('時價') && session.content[0] == "時" ) ) {
      var item = session.content.slice(2)
      item = toSimplified(item.trim())
      if (item == ""){
        return "请输入 时价[商品名称]"
      }
      if (updataNum > 5){
        return "数据源出现严重错误，请通知管理员处理"
      }
      var items_str = ""
      var short_items_str = "";
      var buyCity = []
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      for (var goodsName in GoodsData){
        let nameFlag : boolean = true
        if (goodsName != item){
          if (!(item in GoodsData)){
            for (let str of item){
              if (goodsName.indexOf(str) == -1){
                nameFlag = false
                break
              }
            }
          }
          else{
            nameFlag = false
          }
        }
        if (nameFlag){
          items_str = items_str + "查询到商品" + goodsName + "\n"
          short_items_str = goodsName;
          //console.log(GoodsData[goodsName])
          if ( GoodsData[goodsName]['buy'] != null && Object.keys(GoodsData[goodsName]['buy']).length != 0){
            items_str = items_str + "\n商品购入：\n"
            //console.log(goodsName)
            for ( var cityName in GoodsData[goodsName]['buy']){
              var trend_updown = GoodsData[goodsName]['buy'][cityName]['trend'] === "up" ? "↑" : "↓"
              let time = intervalTime(GoodsData[goodsName]['buy'][cityName]['time'])
              items_str = items_str + cityName + " " + GoodsData[goodsName]['buy'][cityName]['variation'] + "%" + trend_updown + " 时间 " + time + " " +GoodsData[goodsName]['buy'][cityName]['price'].toString() + "\n"
              buyCity.push(cityName)
            }
          }

          var city_list = []
          for (var i = 0;i < 3;i++){
            let max_price = 0
            let max_price_city = ""
            for (var cityName in GoodsData[goodsName]['sell']){

              if (GoodsData[goodsName]['sell'][cityName]['variation'] == 0)
                continue
              if (city_list.indexOf(cityName) != -1)
                continue
              if (GoodsData[goodsName]['sell'][cityName]['price'] > max_price){
                max_price = GoodsData[goodsName]['sell'][cityName]['price']
                max_price_city = cityName
              }
            }
            if (max_price_city != "")
              city_list.push(max_price_city)
          }
          
          //console.log(city_list)




          var base_price_list = []
          let item_list = {}
          if (buyCity.length != 0){
            if (buyCity.length > 1){
              for (var buyCityName in buyCity){
                base_price_list.push(+GoodsData[goodsName]['buy'][buyCity[buyCityName]]['price'])
              }
            }
            else{
              base_price_list.push(+GoodsData[goodsName]['buy'][buyCity[0]]['price'])
            }
            for ( let cityName of city_list){
              if (GoodsData[goodsName]['sell'][cityName]['variation'] == 0)
                continue
              let item_str = ""
              var trend = GoodsData[goodsName]['sell'][cityName]['variation'] + "%"
              var trend_updown = GoodsData[goodsName]['sell'][cityName]['trend'] === "up" ? "↑" : "↓"
              var time = intervalTime(GoodsData[goodsName]['sell'][cityName]['time'])

              item_str = cityName + " " + trend + trend_updown + " 时间 " + time + " 利润 " 
              if (base_price_list.length > 1){
                for (var price in base_price_list){
                  item_str = item_str + buyCity[price][0] + Math.round(+GoodsData[goodsName]['sell'][cityName]['price'] * 1.2 - base_price_list[price] * 0.8) + " "
                }
              }
              else{
                item_str = item_str + Math.round(+GoodsData[goodsName]['sell'][cityName]['price'] * 1.2 - base_price_list[0] * 0.8)
              }
              item_list[cityName] = item_str
            }
          }else{
            for (let cityName of city_list){
              if (GoodsData[goodsName]['sell'][cityName]['variation'] == 0)
                continue
              let item_str = ""
              var trend = GoodsData[goodsName]['sell'][cityName]['variation'] + "%"
              var trend_updown = GoodsData[goodsName]['sell'][cityName]['trend'] === "up" ? "↑" : "↓"
              var time = intervalTime(GoodsData[goodsName]['sell'][cityName]['time'])

              item_str = cityName + " " + trend + trend_updown + " 时间 " + time + " 售价 " + GoodsData[goodsName]['sell'][cityName]['price']
              item_list[cityName] = item_str
            }
          }

          base_price_list = []
          var base_price = 0
          for (var good in PRODUCTS){
            if (PRODUCTS[good].name === goodsName){
              if (PRODUCTS[good].craft == null)
                break
              items_str = items_str + "\n原材料购入：\n"
              for (var craftGood in PRODUCTS[good]['craft']){
                var craftBuyCity = ""
                var craftGoodsPrice = 99999
                //console.log(craftGood)
                //console.log(craftGood)
                if (craftGood in GoodsData && Object.keys(GoodsData[craftGood]['buy']).length != 0){
                  //console.log(GoodsData[craftGood])
                  for (var cityName in GoodsData[craftGood]['buy']){
                    //console.log(GoodsData[craftGood]['buy'])
                    if(GoodsData[craftGood]['buy'][cityName].price < craftGoodsPrice){
                      let trend = GoodsData[craftGood]['buy'][cityName]['variation'] + "%"
                      let trend_updown = GoodsData[craftGood]['buy'][cityName]['trend'] === "up" ? "↑" : "↓"
                      let time = intervalTime(GoodsData[craftGood]['buy'][cityName]['time'])
                      craftBuyCity = cityName
                      craftGoodsPrice = GoodsData[craftGood]['buy'][cityName].price
                      items_str = items_str + craftGood + " " + cityName + " " + trend + trend_updown + " 时间 " + time + " " + craftGoodsPrice + "\n"
                    }
                  }
                  base_price = base_price + PRODUCTS[good]['craft'][craftGood] * craftGoodsPrice
                  }
                else{
                  items_str = items_str  + craftGood + " 无出售数据,未计入成本。\n"
                }
                }
                base_price_list.push(base_price)
                for ( let cityName of city_list){
                  if (GoodsData[goodsName]['sell'][cityName]['variation'] == 0)
                    continue
                  var trend = GoodsData[goodsName]['sell'][cityName]['variation'] + "%"
                  var trend_updown = GoodsData[goodsName]['sell'][cityName]['trend'] === "up" ? "↑" : "↓"
                  var time = intervalTime(GoodsData[goodsName]['sell'][cityName]['time'])
                  if (!(cityName in item_list ))
                    item_list[cityName] = cityName + " " + trend + trend_updown + " 时间 " + time
                  if (base_price_list.length > 1){
                    for (var price in base_price_list){
                      item_list[cityName] = item_list[cityName] + " 制造物利润 " + Math.round(+GoodsData[goodsName]['sell'][cityName]['price'] * 1.2 - base_price_list[price] * 0.8)
                    }
                  }
                  else{
                    item_list[cityName] = item_list[cityName] + " 制造物利润 " + Math.round(+GoodsData[goodsName]['sell'][cityName]['price'] * 1.2 - base_price_list[0] * 0.8)
                    //console.log(GoodsData[goodsName]['sell'][cityName]['price'], base_price_list[0])
                  }
              }
            }
          }
          items_str = items_str + "\n商品出售：\n"
          short_items_str = short_items_str + "出售\n";
          for (let i in item_list){
            items_str = items_str + item_list[i] + "\n"
          }
          for (let i in item_list) {
            short_items_str = short_items_str + item_list[i];
            break;
          }
          const wulinyuanSellPriceLine = getWulinyuanSellPriceLine(goodsName);
          if (wulinyuanSellPriceLine) {
            items_str = items_str + "\n" + wulinyuanSellPriceLine;
            short_items_str = short_items_str + "\n\n" + wulinyuanSellPriceLine;
          }
          break
        }
      }

      if (items_str == ""){
        const wulinyuanCityPriceOutput = getWulinyuanCityPriceOutput(item);
        if (wulinyuanCityPriceOutput) {
          items_str = wulinyuanCityPriceOutput;
          short_items_str = wulinyuanCityPriceOutput;
        }
        for (let cityName in cityItemList){
          if (items_str !== "") {
            break;
          }
          let nameFlag = true
          for (let str of item){
            if (cityName.indexOf(str) == -1){
              nameFlag = false
              break
            }
          }
          if (nameFlag){
            if (!isAdminSession(session)) {
              short_items_str = "为维护本群聊天环境不支持查询城市\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126";
            }
            items_str = items_str + "查询到城市" + cityName + "\n\n"
            for (let goodsName in cityItemList[cityName]){
              if(!(cityName in GoodsData[cityItemList[cityName][goodsName]]['buy']))
                continue
              //console.log(cityItemList[cityName][goodsName])
              var trend_updown = GoodsData[cityItemList[cityName][goodsName]]['buy'][cityName]['trend'] === "up" ? "↑" : "↓"
              let time = intervalTime(GoodsData[cityItemList[cityName][goodsName]]['buy'][cityName]['time'])
              items_str = items_str + cityItemList[cityName][goodsName] + " " + GoodsData[cityItemList[cityName][goodsName]]['buy'][cityName]['variation'] + "%" + trend_updown + " 时间 " + time + " " +GoodsData[cityItemList[cityName][goodsName]]['buy'][cityName]['price'].toString() + "\n"
            }
            break
          }
        }
        if (items_str == "")
          items_str = "未查询到名为" + item + "的商品或城市。"
      }
      if (!isShortTeamRestricted(session))
        return h("quote", { id: session.event.message.id }) + items_str;
      else
        return short_items_str;
      } else {
      // 如果去掉这一行，那么不满足上述条件的消息就不会进入下一个中间件了
      return next()
    }
  })

  ctx.middleware(async (session, next) => {
    if (session.content.includes("买价") && session.content[0] == "买" || session.content.includes("買價") && session.content[0] == "買") {
      if (isShortTeamRestricted(session)) {
        return "为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126";
      }
      var item = session.content.slice(2);
      item = toSimplified(item.trim());
      if (item == "") {
        return "请输入 买价[商品名称]";
      }
      if (updataNum > 5) {
        return "数据源出现严重错误，请通知管理员处理";
      }
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      var items_str = "";
      var buyCity = [];
      for (var goodsName in GoodsData) {
        let nameFlag = true;
        if (goodsName != item) {
          if (!(item in GoodsData)) {
            for (let str of item) {
              if (goodsName.indexOf(str) == -1) {
                nameFlag = false;
                break;
              }
            }
          } else {
            nameFlag = false;
          }
        }
        if (nameFlag) {
          items_str = items_str + "查询到商品" + goodsName + "\n";
          if (GoodsData[goodsName]["buy"] != null && Object.keys(GoodsData[goodsName]["buy"]).length != 0) {
            items_str = items_str + "商品购入：\n";
            for (var cityName in GoodsData[goodsName]["buy"]) {
              var trend_updown = GoodsData[goodsName]["buy"][cityName]["trend"] === "up" ? "↑" : "↓";
              let time = intervalTime(GoodsData[goodsName]["buy"][cityName]["time"]);
              items_str = items_str + cityName + " " + GoodsData[goodsName]["buy"][cityName]["variation"] + "%" + trend_updown + " 时间 " + time + " " + GoodsData[goodsName]["buy"][cityName]["price"].toString() + "\n";
              buyCity.push(cityName);
            }
          }
          var city_list = [];
          for (var i = 0; i < 3; i++) {
            let max_price = 0;
            let max_price_city = "";
            for (var cityName in GoodsData[goodsName]["sell"]) {

              if (GoodsData[goodsName]["sell"][cityName]["variation"] == 0)
                continue;
              if (city_list.indexOf(cityName) != -1)
                continue;
              if (GoodsData[goodsName]["sell"][cityName]["price"] > max_price) {
                max_price = GoodsData[goodsName]["sell"][cityName]["price"];
                max_price_city = cityName;
              }
            }
            if (max_price_city != "")
              city_list.push(max_price_city);
          }
          var base_price_list = [];
          var base_price = 0;
          for (var good in PRODUCTS) {
            if (PRODUCTS[good].name === goodsName) {
              if (PRODUCTS[good].craft == null)
                break;
              items_str = items_str + "原材料购入：\n";
              for (var craftGood in PRODUCTS[good]["craft"]) {
                var craftBuyCity = "";
                var craftGoodsPrice = 99999;
                if (craftGood in GoodsData && Object.keys(GoodsData[craftGood]["buy"]).length != 0) {
                  for (var cityName in GoodsData[craftGood]["buy"]) {
                    if (GoodsData[craftGood]["buy"][cityName].price < craftGoodsPrice) {
                      let trend = GoodsData[craftGood]["buy"][cityName]["variation"] + "%";
                      let trend_updown2 = GoodsData[craftGood]["buy"][cityName]["trend"] === "up" ? "↑" : "↓";
                      let time = intervalTime(GoodsData[craftGood]["buy"][cityName]["time"]);
                      craftBuyCity = cityName;
                      craftGoodsPrice = GoodsData[craftGood]["buy"][cityName].price;
                      items_str = items_str + craftGood + " " + cityName + " " + trend + trend_updown2 + " 时间 " + time + " " + craftGoodsPrice + "\n";
                    }
                  }
                  base_price = base_price + PRODUCTS[good]["craft"][craftGood] * craftGoodsPrice;
                } else {
                  items_str = items_str + craftGood + " 无出售数据。\n";
                }
              }
            }
          }
          break;
        }
      }
      if (items_str == "") {
        const wulinyuanCityPriceOutput = getWulinyuanCityPriceOutput(item);
        if (wulinyuanCityPriceOutput) {
          items_str = wulinyuanCityPriceOutput;
        }
        for (let cityName2 in cityItemList) {
          if (items_str !== "") {
            break;
          }
          let nameFlag = true;
          for (let str of item) {
            if (cityName2.indexOf(str) == -1) {
              nameFlag = false;
              break;
            }
          }
          if (nameFlag) {
            items_str = items_str + "查询到城市" + cityName2 + "\n\n";
            for (let goodsName2 in cityItemList[cityName2]) {
              if (!(cityName2 in GoodsData[cityItemList[cityName2][goodsName2]]["buy"]))
                continue;
              var trend_updown = GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["trend"] === "up" ? "↑" : "↓";
              let time = intervalTime(GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["time"]);
              items_str = items_str + cityItemList[cityName2][goodsName2] + " " + GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["variation"] + "%" + trend_updown + " 时间 " + time + " " + GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["price"].toString() + "\n";
            }
            break;
          }
        }
        if (items_str == "")
          items_str = "未查询到名为" + item + "的商品或城市。";
      }
      return h("quote", { id: session.event.message.id }) + items_str;
    } else {
      return next();
    }
  });

  ctx.middleware(async (session, next) => {
    if (session.content.includes("详价") && session.content[0] == "详" || session.content.includes("詳價") && session.content[0] == "詳") {
      if (isShortTeamRestricted(session)) {
        return "为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126";
      }
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      var item = session.content.slice(2);
      item = toSimplified(item.trim());
      if (item == "") {
        return "请输入 详价[商品名称]";
      }
      if (updataNum > 5) {
        return "数据源出现严重错误，请通知管理员处理";
      }
      var items_str = "";
      var buyCity = [];
      for (var goodsName in GoodsData) {
        let nameFlag = true;
        if (goodsName != item) {
          if (!(item in GoodsData)) {
            for (let str of item) {
              if (goodsName.indexOf(str) == -1) {
                nameFlag = false;
                break;
              }
            }
          } else {
            nameFlag = false;
          }
        }
        if (nameFlag) {
          items_str = items_str + "查询到商品" + goodsName + "\n";
          if (GoodsData[goodsName]["buy"] != null && Object.keys(GoodsData[goodsName]["buy"]).length != 0) {
            items_str = items_str + "\n商品购入：\n";
            for (var cityName in GoodsData[goodsName]["buy"]) {
              var trend_updown = GoodsData[goodsName]["buy"][cityName]["trend"] === "up" ? "↑" : "↓";
              let time2 = intervalTime(GoodsData[goodsName]["buy"][cityName]["time"]);
              items_str = items_str + cityName + " " + GoodsData[goodsName]["buy"][cityName]["variation"] + "%" + trend_updown + " 时间 " + time2 + " " + GoodsData[goodsName]["buy"][cityName]["price"].toString() + "\n";
              buyCity.push(cityName);
            }
          }
          var base_price_list = [];
          let item_list = {};
          if (buyCity.length != 0) {
            if (buyCity.length > 1) {
              for (var buyCityName in buyCity) {
                base_price_list.push(+GoodsData[goodsName]["buy"][buyCity[buyCityName]]["price"]);
              }
            } else {
              base_price_list.push(+GoodsData[goodsName]["buy"][buyCity[0]]["price"]);
            }
            for (var cityName in GoodsData[goodsName]["sell"]) {
              if (GoodsData[goodsName]["sell"][cityName]["variation"] == 0)
                continue;
              let item_str = "";
              var trend = GoodsData[goodsName]["sell"][cityName]["variation"] + "%";
              var trend_updown = GoodsData[goodsName]["sell"][cityName]["trend"] === "up" ? "↑" : "↓";
              var time = intervalTime(GoodsData[goodsName]["sell"][cityName]["time"]);
              item_str = cityName + " " + trend + trend_updown + " 时间 " + time + " 利润 ";
              if (base_price_list.length > 1) {
                for (var price in base_price_list) {
                  item_str = item_str + buyCity[price][0] + Math.round(+GoodsData[goodsName]["sell"][cityName]["price"] * 1.2 - base_price_list[price] * 0.8) + " ";
                }
              } else {
                item_str = item_str + Math.round(+GoodsData[goodsName]["sell"][cityName]["price"] * 1.2 - base_price_list[0] * 0.8);
              }
              item_list[cityName] = item_str;
            }
          } else {
            for (var cityName in GoodsData[goodsName]["sell"]) {
              if (GoodsData[goodsName]["sell"][cityName]["variation"] == 0)
                continue;
              let item_str = "";
              var trend = GoodsData[goodsName]["sell"][cityName]["variation"] + "%";
              var trend_updown = GoodsData[goodsName]["sell"][cityName]["trend"] === "up" ? "↑" : "↓";
              var time = intervalTime(GoodsData[goodsName]["sell"][cityName]["time"]);
              item_str = cityName + " " + trend + trend_updown + " 时间 " + time + " 售价 " + GoodsData[goodsName]["sell"][cityName]["price"];
              item_list[cityName] = item_str;
            }
          }
          base_price_list = [];
          var base_price = 0;
          for (var good in PRODUCTS) {
            if (PRODUCTS[good].name === goodsName) {
              if (PRODUCTS[good].craft == null)
                break;
              items_str = items_str + "\n原材料购入：\n";
              for (var craftGood in PRODUCTS[good]["craft"]) {
                var craftBuyCity = "";
                var craftGoodsPrice = 99999;
                if (craftGood in GoodsData && Object.keys(GoodsData[craftGood]["buy"]).length != 0) {
                  for (var cityName in GoodsData[craftGood]["buy"]) {
                    if (GoodsData[craftGood]["buy"][cityName].price < craftGoodsPrice) {
                      let trend2 = GoodsData[craftGood]["buy"][cityName]["variation"] + "%";
                      let trend_updown2 = GoodsData[craftGood]["buy"][cityName]["trend"] === "up" ? "↑" : "↓";
                      let time2 = intervalTime(GoodsData[craftGood]["buy"][cityName]["time"]);
                      craftBuyCity = cityName;
                      craftGoodsPrice = GoodsData[craftGood]["buy"][cityName].price;
                      items_str = items_str + craftGood + " " + cityName + " " + trend2 + trend_updown2 + " 时间 " + time2 + " " + craftGoodsPrice + "\n";
                    }
                  }
                  base_price = base_price + PRODUCTS[good]["craft"][craftGood] * craftGoodsPrice;
                } else {
                  items_str = items_str + craftGood + " 无出售数据,未计入成本。\n";
                }
              }
              base_price_list.push(base_price);
              for (var cityName in GoodsData[goodsName]["sell"]) {
                if (GoodsData[goodsName]["sell"][cityName]["variation"] == 0)
                  continue;
                var trend = GoodsData[goodsName]["sell"][cityName]["variation"] + "%";
                var trend_updown = GoodsData[goodsName]["sell"][cityName]["trend"] === "up" ? "↑" : "↓";
                var time = intervalTime(GoodsData[goodsName]["sell"][cityName]["time"]);
                if (!(cityName in item_list))
                  item_list[cityName] = cityName + " " + trend + trend_updown + " 时间 " + time;
                if (base_price_list.length > 1) {
                  for (var price in base_price_list) {
                    item_list[cityName] = item_list[cityName] + " 制造物利润 " + Math.round(+GoodsData[goodsName]["sell"][cityName]["price"] * 1.2 - base_price_list[price] * 0.8);
                  }
                } else {
                  item_list[cityName] = item_list[cityName] + " 制造物利润 " + Math.round(+GoodsData[goodsName]["sell"][cityName]["price"] * 1.2 - base_price_list[0] * 0.8);
                }
              }
            }
          }
          items_str = items_str + "\n商品出售：\n";
          for (let i in item_list) {
            items_str = items_str + item_list[i] + "\n";
          }
          const wulinyuanSellPriceLine = getWulinyuanSellPriceLine(goodsName);
          if (wulinyuanSellPriceLine) {
            items_str = items_str + "\n" + wulinyuanSellPriceLine;
          }
          break;
        }
      }
      if (items_str == "") {
        for (let cityName2 in cityItemList) {
          let nameFlag = true;
          for (let str of item) {
            if (cityName2.indexOf(str) == -1) {
              nameFlag = false;
              break;
            }
          }
          if (nameFlag) {
            items_str = items_str + "查询到城市" + cityName2 + "\n\n";
            for (let goodsName2 in cityItemList[cityName2]) {
              if (!(cityName2 in GoodsData[cityItemList[cityName2][goodsName2]]["buy"]))
                continue;
              var trend_updown = GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["trend"] === "up" ? "↑" : "↓";
              let time2 = intervalTime(GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["time"]);
              items_str = items_str + cityItemList[cityName2][goodsName2] + " " + GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["variation"] + "%" + trend_updown + " 时间 " + time2 + " " + GoodsData[cityItemList[cityName2][goodsName2]]["buy"][cityName2]["price"].toString() + "\n";
            }
            break;
          }
        }
        if (items_str == "")
          items_str = "未查询到名为" + item + "的商品或城市。";
      }
      return h("quote", { id: session.event.message.id }) + items_str;
    } else {
      return next();
    }
  });

  ctx.command("无往不利成就")
  .action(async ({ session }) => {
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
    if (updataNum < 5){
      var sellPrice = 0
      var sellCity = ""
      var sellVariation = ""
      var sellTrend_updown = ""
      for (var cityName in GoodsData["纯金线材"]['sell']){
          if ( GoodsData["纯金线材"]['sell'][cityName].price > sellPrice){
            sellPrice = GoodsData["纯金线材"]['sell'][cityName].price
            sellCity = cityName
            sellVariation = +GoodsData['纯金线材']['sell'][cityName].variation + "%"
            sellTrend_updown = GoodsData['纯金线材']['sell'][cityName].trend === "up" ? "↑" : "↓"
          }
      }

      var buyPrice = GoodsData['沙金']['buy']['淘金乐园'].price
      var buyVariation = +GoodsData['沙金']['buy']['淘金乐园'].variation + "%"
      var buyTrend_updown = GoodsData['沙金']['buy']['淘金乐园'].trend === "up" ? "↑" : "↓"

      var price = Math.round(sellPrice * 1.2 - buyPrice * 0.75 * 0.8)
      //console.log(sellPrice, buyPrice)
      var needNum = Math.ceil(5000000 / ((sellPrice * 1.2) - (buyPrice * 0.75 * 0.8)))

      var outputStr = "无往不利成就计算\n三级制造台 满抬满砍 未计算副产 未计算垃圾\n"
      outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
      outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n"
      outputStr = outputStr + "大概所需金线数量" + needNum.toString()
      session.send(h('quote', { id: session.messageId }) + outputStr)
    }
    else
      session.send(h('quote', { id: session.messageId }) + "数据源出现严重错误，请通知管理员处理")

    //console.log(outputStr)
    //session.send(h('at', { id: session.userId }) + outputStr)
  });

  ctx.middleware(async (session, next) => {
    if (session.content.includes('点石成金成就计算') && session.content[0] == "点") {
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      var num = session.content.slice(8)
      num = num.trim()
      if (num == "")
        num = "1136"

      if (updataNum > 5)
        return "数据源出现严重错误，请通知管理员处理"
      
      var sellPrice = 0
      var sellCity = ""
      var sellVariation = ""
      var sellTrend_updown = ""
      for (var cityName in GoodsData["纯金线材"]['sell']){
          if ( GoodsData["纯金线材"]['sell'][cityName].price > sellPrice){
            sellPrice = GoodsData["纯金线材"]['sell'][cityName].price
            sellCity = cityName
            sellVariation = +GoodsData['纯金线材']['sell'][cityName].variation + "%"
            sellTrend_updown = GoodsData['纯金线材']['sell'][cityName].trend === "up" ? "↑" : "↓"
          }
      }

      var buyPrice = GoodsData['沙金']['buy']['淘金乐园'].price
      var buyVariation = +GoodsData['沙金']['buy']['淘金乐园'].variation + "%"
      var buyTrend_updown = GoodsData['沙金']['buy']['淘金乐园'].trend === "up" ? "↑" : "↓"

      var price = Math.round(sellPrice * 1.2 - buyPrice * 0.75 * 0.8)
      //console.log(sellPrice, buyPrice)
      var needNum = Math.ceil(11360000 / ((sellPrice * 1.2) - (buyPrice * 0.75 * 0.8)))
      var outputStr = "点石成金成就计算\n三级制造台 满抬满砍 未计算副产 未计算垃圾\n\n"
      if (needNum <= 1136 && +num >= needNum ){
        outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
        outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n"
        outputStr = outputStr + "当前行情可以直接完成点石成金成就\n"
        outputStr = outputStr + "大概所需金线数量" + needNum.toString()
      }
      else{
        let needPrice = (+num * sellPrice * 1.2 - 11360000) / (+num * 0.75 * 0.8)
        //let needPrice = (+num * 8525 * 1.2 *  1.2 - 11360000) / (+num * 0.75 * 0.8)
        let needVariation =  Math.floor(needPrice / buyPrice * 100)
        //console.log(needPrice)
        //console.log(needVariation)
        if(needVariation >= 60){
          outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
          outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n"
          outputStr = outputStr + "当前价格无法直接完成点石成金成就\n\n"
          // 11360000 = 1136 * sellPrice * 1.2 - 1136 * buyPrice * 0.75 * 0.8
          // 1136 * buyPrice * 0.75 * 0.8 = (1136 * sellPrice * 1.2 - 11360000)
          // buyPrice  = (1136 * sellPrice * 1.2 - 11360000) / (1136 * 0.75 * 0.8)
          outputStr = outputStr + "假如你已有金线数量为" + num + "\n\n"

          outputStr = outputStr + "你需要保证你购买的沙金价格大概在" + needVariation + "%" + "及以下才能达成成就"
        }else{
          outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
          outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n\n"
          outputStr = outputStr + "假如你已有金线数量为" + num + "\n"
          outputStr = outputStr + "当前无法以任何方式完成点石成金成就 请等待金线价格上涨"
        }
      }
      //console.log(outputStr)
      //session.send(h('at', { id: session.userId }) + outputStr)
      session.send(h('quote', { id: session.messageId }) + outputStr)
    }else {
      // 如果去掉这一行，那么不满足上述条件的消息就不会进入下一个中间件了
      return next()
    }
  })

  ctx.command("有行情吗")
  .action(async ({ session }) => {
    if (updataNum < 5){
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      let out_str = ""
      //console.log(min)
      //console.log(low_min)
      if(min < smallPrice && low_min < lowSmallPrice)
        out_str = out_str + "没有"
      else{
        if (min>=smallPrice && min < bigPrice)
          out_str = out_str + "有小行情"
        else if (min>=bigPrice)
          out_str = out_str + "有大行情"
        
        //console.log(low_min>=lowSmallPrice && low_min < lowBigPrice)
        //console.log(lowSmallPrice)
        //console.log(lowBigPrice)
        if (low_min>=lowSmallPrice && low_min < lowBigPrice)
          if (out_str != ""){
            out_str = out_str +"和非海角城小行情"
          }
          else{
            out_str = out_str + "有非海角城小行情"
          }
        else if (low_min>=lowBigPrice)
          if (out_str != ""){
            out_str = out_str + "和非海角城大行情"
          }
          else{
            out_str = out_str + "有非海角城大行情"
          }
      }
      session.send((h('quote', { id: session.messageId })) + out_str)  
    }
    else
      session.send((h('quote', { id: session.messageId })) + "数据源出现严重错误，请通知管理员处理")  
  })

  ctx.command("有行情嗎")
  .action(async ({ session }) => {
    if (updataNum < 5){
      var GoodsData: GetPricesProducts;
      if (SteamTeamList.indexOf(session.channelId) !== -1){
        GoodsData = responseDataSteam
      }
      else{
        GoodsData = responseData
      }
      let out_str = ""
      //console.log(min)
      //console.log(low_min)
      if(min < smallPrice && low_min < lowSmallPrice)
        out_str = out_str + "没有"
      else{
        if (min>=smallPrice && min < bigPrice)
          out_str = out_str + "有小行情"
        else if (min>=bigPrice)
          out_str = out_str + "有大行情"
        
        //console.log(low_min>=lowSmallPrice && low_min < lowBigPrice)
        //console.log(lowSmallPrice)
        //console.log(lowBigPrice)
        if (low_min>=lowSmallPrice && low_min < lowBigPrice)
          if (out_str != ""){
            out_str = out_str +"和非海角城小行情"
          }
          else{
            out_str = out_str + "有非海角城小行情"
          }
        else if (low_min>=lowBigPrice)
          if (out_str != ""){
            out_str = out_str + "和非海角城大行情"
          }
          else{
            out_str = out_str + "有非海角城大行情"
          }
      }
      session.send((h('quote', { id: session.messageId })) + out_str)  
    }
    else
      session.send((h('quote', { id: session.messageId })) + "数据源出现严重错误，请通知管理员处理")  
  })

  ctx.command("数据更新")
  .action(async ({ session }) => {
    if (isAdminSession(session)){
      session.send("正在更新数据ing......")
      errorNum = 0
      updata_columba_data(ctx)
    }
    else{
      session.send("权限不足")
    }
  })
  ctx.middleware(async (session, next) => {
    if (session.channelId == "957035373") {
      if (isAdminSession(session) || isAllowedSpecialCurrencyMessage(session.content) || session.content.includes("数据更新") || session.content.includes("有行情嗎") || session.content.includes("有行情吗") || session.content.includes("无往不利成就") || session.content.includes("詳細行情") || session.content.includes("当前行情") || session.content.includes("详细行情") || session.content.includes("無海行情") || session.content.includes("當前行情") || session.content.includes("无海行情") || session.content.includes("菜单") || session.content.includes("wiki") || session.content.includes("科伦巴商会") || session.content.includes("配队攻略") || session.content.includes("乘员图鉴") || session.content.includes("装备图鉴") || session.content.includes("武装图鉴") || session.content.includes("词条图鉴") || session.content.includes("伤害公式") || session.content.includes("客运路线") || session.content.includes("雷索周报") || session.content.includes("兑换码") || session.content.includes("表情包制作") || session.content.includes("制造数据") || session.content.includes("新手攻略")) {
        let i;
        i = i;
      } else
        ctx.bots["onebot:" + qqID].deleteMessage(session.channelId, session.messageId);
    } else {
      return next();
    }
  });

}
