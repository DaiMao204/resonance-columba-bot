import { Product, ProductUnlockConditions } from "../interfaces/product";
import {
  GOODS_UNLOCK_CONDITIONS as goodsUnlockConditions,
  PRODUCTS as pdtData,
} from "resonance-data-columba/dist/columbabuild";


export var product = []

export var PRODUCT_UNLOCK_CONDITIONS: ProductUnlockConditions = goodsUnlockConditions;

const pdts: Product[] = Object.values(pdtData) as Product[];

export var PRODUCTS: Product[] = pdts;

export function products_set (pdtData, goodsUnlockConditions){
  const pdts: Product[] = Object.values(pdtData) as Product[];
  PRODUCTS = pdts
  PRODUCT_UNLOCK_CONDITIONS = goodsUnlockConditions;
}

export function products_set_new (pdtData){
  const pdts: Product[] = Object.values(pdtData) as Product[];
  PRODUCTS = pdts
}
