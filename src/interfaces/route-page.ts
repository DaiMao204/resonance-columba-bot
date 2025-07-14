import { CityName } from "../data/cicies";
import { GetPricesProduct } from "./get-prices";
import { PlayerConfig } from "./player-config";
import { Product } from "./product";

export interface Buy {
  fromCity: CityName;
  product: string;
  buyPrice: number;
  buyLot: number;
  buyTaxRate: number;
}

export interface Exchange extends Buy {
  toCity: CityName;
  sellPrice: number;
  singleProfit: number;
  lotProfit: number;
}

export interface CityProductProfitAccumulatedExchange extends Exchange {
  // not restock
  accumulatedProfit: number;
  loss: boolean; // true if acculated a 0 or negative profit
  accumulatedLot: number;

  // restock
  restockCount: number;
  restockAccumulatedProfit: number;
  restockAccumulatedLot: number;

  // fatigue
  fatigue?: number;
  profitPerFatigue?: number;

  isForFillCargo?: boolean;
}

export interface CityGroupedExchanges {
  [fromCity: CityName]: {
    [toCity: CityName]: CityProductProfitAccumulatedExchange[];
  };
}

export interface OneGraphRouteDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  data?: OneGraphRouteDialogData;
}

export interface OneGraphRouteDialogData {
  stats: OnegraphBuyCombinationTwoWayStats;
  playerConfig: PlayerConfig;
  fromCity: CityName;
  toCity: CityName;
}

export interface OnegraphPriceData {
  [fromCity: CityName]: {
    [toCity: CityName]: OnegraphPriceDataItem[];
  };
}

export interface OnegraphPriceDataItem {
  name: string;
  product: Product;
  priceData: GetPricesProduct;
  buyPrice: number;
  buyLot: number;
  buyTaxRate: number;
  sellPrice: number;
  singleProfit: number;
}

export interface OnegraphBuyCombination {
  availableLot: number;
  buyLot: number;
  name: string;
  profit: number;
}

export interface OnegraphBuyCombinationStats {
  combinations: OnegraphBuyCombination[];
  profit: number;
  restock: number;
  fatigue: number;
  profitPerFatigue: number;
  generalProfitIndex: number;
  usedLot: number;
  lastNotWastingRestock: number; // if not wasting, this equals to restock, otherwise it is the last restock count that is not wasting
}

export interface OnegraphBuyCombinations {
  [fromCity: CityName]: {
    [toCity: CityName]: {
      [restock: number]: OnegraphBuyCombinationStats;
    };
  };
}

export interface OnegraphRecommendations {
  [fromCity: CityName]: {
    [toCity: CityName]: OnegraphBuyCombinationTwoWayStats;
  };
}

export interface OnegraphBuyCombinationTwoWayStats {
  simpleGo: OnegraphBuyCombinationStats;
  goAndReturn: OnegraphBuyCombinationStats[];
  goAndReturnTotal: OnegraphBuyCombinationStats;
}

export interface OnegraphTopProfitItem {
  fromCity: CityName;
  toCity: CityName;
  profit: number;
  profitPerFatigue: number;
  generalProfitIndex: number;
  reco: OnegraphBuyCombinationTwoWayStats;
}

export interface OnegraphTopProfitSortedBy {
  go: OnegraphTopProfitItem[];
  goAndReturn: OnegraphTopProfitItem[];
}

export interface OnegraphTopProfit {
  byProfit: OnegraphTopProfitSortedBy;
  byProfitPerFatigue: OnegraphTopProfitSortedBy;
  byGeneralProfitIndex: OnegraphTopProfitSortedBy;
}
