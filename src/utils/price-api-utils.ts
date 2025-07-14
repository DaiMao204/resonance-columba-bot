import { CityName } from "../data/cicies";
import { PRODUCTS } from "../data/products";
import { cityList } from "../data/cicies";
import { products_default } from "../data/products";
import {
  FireStoreProductCityPrice,
  FirestoreProducts,
  GetPricesProduct,
  GetPricesProductCityPrice,
  GetPricesProductPrice,
  GetPricesProducts,
  LbGetPricesProduct,
  LbGetPricesProductCityPrice,
  LbGetPricesProductPrice,
  LbGetPricesProducts,
  NewGetPricesProducts,
  NewGetPricesProductCityPrice,
  NewGetPricesProductPrice,
  NewGetPricesProduct
  
} from "../interfaces/get-prices";

export const convertFirebaseDataToGetPricesData = (data: LbGetPricesProducts): GetPricesProducts => {
  const responseData: GetPricesProducts = {};
  for (const pdtName in data) {
    const pdt = data[pdtName];
    const pdtData: GetPricesProduct = {};
    for (const type in pdt) {
      const typeData: GetPricesProductPrice = {};
      for (const city in pdt[type]) {
        const cityData: LbGetPricesProductCityPrice = pdt[type][city];
        let price = cityData.p;
        // no price in data, calculate it with base price and variation
        if (!price) {
          price = calculatePrice(pdtName, city as CityName, type as "b" | "s", cityData.v) ?? undefined;
        }
        //console.log(cityData)
        typeData[cityList[+city - 1]] = {
          trend: cityData.t === 0 ? "down" : "up",
          variation: cityData.v,
          time: cityData.ti,
          price,
        }
        //console.log(typeData[city])
      }
      if (type == "b"){
        pdtData["buy"] = typeData;
      }
      else{
        pdtData["sell"] = typeData;
      }
    }
    //console.log(pdtData)
    //console.log(pdtName)
    //console.log(pdtData)
    //console.log(PRODUCTS[+pdtName - 1])
    responseData[PRODUCTS[+pdtName - 1].name] = pdtData;
  }
  //console.log(responseData)

  return responseData;
};

export const convertFirebaseDataToGetPricesDataNew = (data: NewGetPricesProducts): GetPricesProducts => {
  const responseData2: GetPricesProducts = {};
  for (const pdtName in data) {
    const pdt = data[pdtName];
    const pdtData2:GetPricesProduct = {};
    pdtData2["buy"] = {};
    pdtData2["sell"] = {};
    for (const type in pdt) {
      const typeData:GetPricesProductPrice = {};
      for (let city in pdt[type]) {
        const cityData:NewGetPricesProductCityPrice = pdt[type][city];
        if (city == "7号自由港")
          city = "七号自由港";
        if (cityList.indexOf(city) === -1)
          continue;
        typeData[city] = {
          trend: cityData.trend === -1 ? "down" : "up",
          variation: Math.round(cityData.price / cityData.base_price * 100),
          time: cityData.ti,
          price: cityData.price
        };
      }
      if (type == "buy") {
        pdtData2["buy"] = typeData;
      } else {
        pdtData2["sell"] = typeData;
      }
    }
    responseData2[pdtName] = pdtData2;
  }
  return responseData2;
};


const calculatePrice = (pdtName: string, city: CityName, type: "b" | "s", variation: number): number | null => {
  const pdtInfo = PRODUCTS.find((p) => p.name === pdtName);
  let basePrice: number | null = 0;
  if (pdtInfo) {
    if (type === "b") {
      basePrice = pdtInfo.buyPrices[city];
    } else {
      basePrice = pdtInfo.sellPrices[city];
    }
  }
  if (basePrice) {
    return Math.round((basePrice * variation) / 100);
  }
  return null;
};
