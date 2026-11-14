import { Module } from "@medusajs/framework/utils";
import ThlModuleService from "./service";

export const THL_MODULE = "thl";

export default Module(THL_MODULE, {
  service: ThlModuleService,
});
