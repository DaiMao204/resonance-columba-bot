import { CityName } from "../data/cicies";

export interface Fatigue {
  cities: CityName[]; // must be length 2
  fatigue?: number;
}