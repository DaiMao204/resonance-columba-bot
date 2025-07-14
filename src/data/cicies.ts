import { CITY_ATTACH_LIST } from "resonance-data-columba/dist/columbabuild";
import { PRODUCTS } from "./products";

export const cityList = [
    "修格里城",
    "铁盟哨站",
    "七号自由港",
    "澄明数据中心",
    "阿妮塔战备工厂",
    "阿妮塔能源研究所",
    "荒原站",
    "曼德矿场",
    "淘金乐园",
    "阿妮塔发射中心",
    "海角城",
    "云岫桥基地",
    "汇流塔",
    "远星大桥",
    "栖羽站",
    "岚心城",
    "塔图站",
    "黑月游乐城",
    "贡露城"
  ];
  
export var cityItemList = {};

/*var CITY_ATTACH_LIST = {
    荒原站: "修格里城",
    淘金乐园: "曼德矿场",
    阿妮塔战备工厂: "澄明数据中心",
    阿妮塔能源研究所: "七号自由港",
    铁盟哨站: "修格里城"
  };*/

export type CityName = (typeof cityList)[number];
export var CITIES: CityName[] = cityList;

var cityAttachList: { [key: CityName]: CityName } = CITY_ATTACH_LIST;
export var CITY_BELONGS_TO = cityAttachList;

export function cicies_set (CITY_ATTACH_LIST){
  cityAttachList = CITY_ATTACH_LIST;
  CITY_BELONGS_TO = cityAttachList
}

export function cityItems_set(){
  for (let item in PRODUCTS){
    if ('buyPrices' in PRODUCTS[item]){
      for (let cityName in PRODUCTS[item]['buyPrices']){
        if (!(cityName in cityItemList))
          cityItemList[cityName] = []
        if (!(cityItemList[cityName].includes(PRODUCTS[item]['name'])) && PRODUCTS[item]['buyPrices'][cityName] != 99999)
          cityItemList[cityName].push(PRODUCTS[item]['name'])
      }
    }
  }
  //console.log(cityItemList)
}