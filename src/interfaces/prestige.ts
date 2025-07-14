import { CityName } from "../data/cicies";

export interface PrestigeConfig {
  level: number;
  generalTax: number;
  specialTax: {
    [cityName: CityName]: number;
  };
  extraBuy: number;
}