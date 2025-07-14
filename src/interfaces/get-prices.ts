import { CityName } from "../data/cicies";
import { LbTrend, Trend, NewTrend } from "./trend";

export interface GetPricesProductCityPrice {
  trend: Trend;
  variation: number;
  time: number;
  price?: number;
}

export interface GetPricesProductPrice {
  [city: CityName]: GetPricesProductCityPrice;
}

export interface GetPricesProduct {
  [type: string]: GetPricesProductPrice;
}

export interface GetPricesProducts {
  [pdtName: string]: GetPricesProduct;
}

export interface FireStoreProductCityPrice {
  trend: Trend;
  variation: number;
  time: {
    _seconds: number;
    _nanoseconds: number;
  };
  price?: number;
}

export interface FirestoreProductPrice {
  [city: CityName]: FireStoreProductCityPrice;
}

export interface FirestoreProduct {
  [type: string]: FirestoreProductPrice;
}

export interface FirestoreProducts {
  [pdtName: string]: FirestoreProduct;
}

export interface GetPricesResponse {
  data: LbGetPricesProducts;
}

export interface LbGetPricesProductCityPrice {
  t: LbTrend; // 1 for up, 0 for down
  v: number;
  ti: number;
  p?: number;
}

export interface LbGetPricesProductPrice {
  [city: CityName]: LbGetPricesProductCityPrice;
}

export interface LbGetPricesProduct {
  [type: string]: LbGetPricesProductPrice; // type: b or s
}

export interface LbGetPricesProducts {
  [pdtName: string]: LbGetPricesProduct;
}

export interface NewGetPricesProductCityPrice {
    trend: NewTrend;
    base_price: number;
    ti: number;
    price: number;
}

export interface NewGetPricesProductPrice {
    [city: CityName]: NewGetPricesProductCityPrice;
}

export interface NewGetPricesProduct {
    [type: string]: NewGetPricesProductPrice;
}

export interface NewGetPricesProducts {
    [pdtName: string]: NewGetPricesProduct;
}