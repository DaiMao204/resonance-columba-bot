import { Context, Schema, h, Bot, Dict } from 'koishi'
import { cityList, cityItemList,cityListSteam } from './data/cicies'
import { products_default } from './data/data'
import { intervalTime } from './utils/time'
import axios from 'axios';
import { GetPricesProducts } from './interfaces/get-prices';
import { convertFirebaseDataToGetPricesData,convertFirebaseDataToGetPricesDataNew } from './utils/price-api-utils'
import { calculateOneGraphBuyCombinations,getOneGraphRecommendation,calculateGeneralProfitIndex } from './utils/route-page-utils'
import { BotConfig, BotConfigNoReturnBargain, BotConfigSteam, BotConfigNoReturnBargainSteam } from './interfaces/player-config';
import { CITIES,CITIESSTEAM } from './data/cicies';
import { OnegraphRecommendations,OnegraphBuyCombinationStats,OnegraphTopProfit,OnegraphTopProfitItem,OnegraphTopProfitSortedBy } from './interfaces/route-page';
import { PRODUCTS } from './data/products';
import { updata_columba_data } from './data/get-data';
import { cityItems_set } from './data/cicies';
import { toSimplified } from './utils/chinese';
import { it } from 'node:test';

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
  SteamTeamList: Array<string>
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
  SteamTeamList: Schema.array(Schema.string()).default([]).description("steam服群组列表"),
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



export var responseData: GetPricesProducts
export var responseDataSteam: GetPricesProducts


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
  if (price >= 10000 && send_flag_max && MaxTeamList.length != 0) {
    ctx_send.bots["onebot:" + qqID].broadcast(MaxTeamList, (h('at', { type: "all" })) + "当前有10000+大行情 综合利润" + price + "\n" + output_str);
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
  if (price >= 10000 && send_flag_max && MaxTeamList.length != 0) {
    ctx_send.bots["onebot:" + qqID].broadcast(MaxTeamList, (h('at', { type: "all" })) + "当前有10000+大行情 综合利润" + price);
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
var nextTi = Date.now() / 1000 - 60;
var waitTi = 0;

var tiSteam;
var tiIntervalSteam;
var nextTiSteam = Date.now() / 1000 - 60;
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
    responseData = convertFirebaseDataToGetPricesDataNew(data,cityList);

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
    responseData = convertFirebaseDataToGetPricesData(data);
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

  for (let item in ErrorItemList){
    if (ErrorItemList[item] in responseData)
      responseData[ErrorItemList[item]]['buy'] = {}
  }
  //console.log(responseData)

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
  output_str = output_str + "综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1016货仓\n";
  low_output_str = low_output_str + "无海角城版本综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1016货仓\n";
  small_output_str = small_output_str + "综合利润往返跑商行情第一名\n\n";
  //console.log("单票利润往返跑商行情 满抬砍 满声望 满共振 1016货仓")

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
  var getDataUrlSteam = "https://reso-online-steam.soli-reso.com/get_server_trade/"
  let tiNow = Date.now() / 1e3;
  console.log("Steam服")
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
  responseDataSteam = convertFirebaseDataToGetPricesDataNew(data,cityListSteam);


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
  output_str_steam = output_str_steam + "综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1000货仓\n";
  low_output_str_steam = low_output_str_steam + "无海角城版本综合利润往返跑商行情 20疲劳满抬砍 满声望 满共振 1000货仓\n";
  small_output_str_steam = small_output_str_steam + "综合利润往返跑商行情第一名\n\n";
  //console.log("单票利润往返跑商行情 满抬砍 满声望 满共振 1016货仓")

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
  ctx.on("ready", () => {
    ctx_send = ctx;
    const time = ctx.config.TimerTime * 6e4;
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
    bigPrice = ctx.config.BigPrice;
    lowBigPrice = ctx.config.LowBigPrice;
    lowSmallPrice = ctx.config.LowSmallPrice;
    qqID = ctx.config.QQID;
    getDataUrl = ctx.config.DataUrl;
    console.log("插件启动");
    console.log("行情刷新时间为:", time, "毫秒");
    if (ctx.config.StartUrl != "" && ctx.config.StartUrl != null)
      updata_columba_data(ctx, ctx.config.StartUrl, true);
    else
      updata_columba_data(ctx, "", true);
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
  ctx.command("当前行情")
  .action(async ({ session }) => {
    if (ShortTeamList.indexOf(session.channelId) === -1)
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
    if (ShortTeamList.indexOf(session.channelId) === -1 || session.channelId in SteamTeamList)
      session.send(h("quote", { id: session.event.message.id }) + low_output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
    });
  ctx.command("當前行情")
  .action(async ({ session }) => {
    if (ShortTeamList.indexOf(session.channelId) === -1)
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
    if (ShortTeamList.indexOf(session.channelId) === -1 || session.channelId in SteamTeamList)
      session.send(h("quote", { id: session.event.message.id }) + low_output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
    });
  ctx.command("详细行情")
  .action(async ({ session }) => {
    if (ShortTeamList.indexOf(session.channelId) === -1)
      if (SteamTeamList.indexOf(session.channelId) !== -1)
        session.send(h("quote", { id: session.event.message.id }) + output_str_steam);
      else
        session.send(h("quote", { id: session.event.message.id }) + output_str);
    else
      session.send("为维护本群聊天环境不支持本指令\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126");
  });
  ctx.command("詳細行情")
  .action(async ({ session }) => {
    if (ShortTeamList.indexOf(session.channelId) === -1)
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
          break
        }
      }

      if (items_str == ""){
        for (let cityName in cityItemList){
          let nameFlag = true
          for (let str of item){
            if (cityName.indexOf(str) == -1){
              nameFlag = false
              break
            }
          }
          if (nameFlag){
            short_items_str = "为维护本群聊天环境不支持查询城市\n如有需要请加入以下群聊:\n行情查询群:957035373\n行情通知群:756406126";
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
      if (ShortTeamList.indexOf(session.channelId) === -1)
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
      if (ShortTeamList.indexOf(session.channelId) != -1) {
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
      if (ShortTeamList.indexOf(session.channelId) != -1) {
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
        num = "1016"

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
      var needNum = Math.ceil(10000000 / ((sellPrice * 1.2) - (buyPrice * 0.75 * 0.8)))
      var outputStr = "点石成金成就计算\n三级制造台 满抬满砍 未计算副产 未计算垃圾\n\n"
      if (needNum <= 1016 && +num >= needNum ){
        outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
        outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n"
        outputStr = outputStr + "当前行情可以直接完成点石成金成就\n"
        outputStr = outputStr + "大概所需金线数量" + needNum.toString()
      }
      else{
        let needPrice = (+num * sellPrice * 1.2 - 10000000) / (+num * 0.75 * 0.8)
        //let needPrice = (+num * 8525 * 1.2 *  1.2 - 10000000) / (+num * 0.75 * 0.8)
        let needVariation =  Math.floor(needPrice / buyPrice * 100)
        //console.log(needPrice)
        //console.log(needVariation)
        if(needVariation >= 60){
          outputStr = outputStr + "当前最低沙金 淘金乐园 " + buyVariation + buyTrend_updown + " " + buyPrice + "\n"
          outputStr = outputStr + "当前最高金线 " + sellCity + " " + sellVariation + sellTrend_updown + " 利润：" + price + "\n"
          outputStr = outputStr + "当前价格无法直接完成点石成金成就\n\n"
          // 10000000 = 1016 * sellPrice * 1.2 - 1016 * buyPrice * 0.75 * 0.8
          // 1016 * buyPrice * 0.75 * 0.8 = (1016 * sellPrice * 1.2 - 10000000)
          // buyPrice  = (1016 * sellPrice * 1.2 - 10000000) / (1016 * 0.75 * 0.8)
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
    if (session.userId == "1443197830"){
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
      if (session.userId == "1443197830" || session.content.includes("数据更新") || session.content.includes("有行情嗎") || session.content.includes("有行情吗") || session.content.includes("无往不利成就") || session.content.includes("詳細行情") || session.content.includes("当前行情") || session.content.includes("详细行情") || session.content.includes("無海行情") || session.content.includes("當前行情") || session.content.includes("无海行情") || session.content.includes("菜单") || session.content.includes("wiki") || session.content.includes("科伦巴商会") || session.content.includes("配队攻略") || session.content.includes("乘员图鉴") || session.content.includes("装备图鉴") || session.content.includes("武装图鉴") || session.content.includes("词条图鉴") || session.content.includes("伤害公式") || session.content.includes("客运路线") || session.content.includes("雷索周报") || session.content.includes("兑换码") || session.content.includes("表情包制作") || session.content.includes("制造数据") || session.content.includes("新手攻略")) {
        let i;
        i = i;
      } else
        ctx.bots["onebot:" + qqID].deleteMessage(session.channelId, session.messageId);
    } else {
      return next();
    }
  });

}
