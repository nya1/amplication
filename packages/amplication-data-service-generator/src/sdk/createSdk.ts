import { AppInfo } from "../index";
import { Module, Entity } from "../types";
import { createApi } from "./api/createApi";
import { BASE_DIRECTORY } from "./constants";
import { createModelsModules } from "./models/createModels";
import { createPackageJson } from "./npm/createPackageJson";

export async function createSdkModules(
  appInfo: AppInfo,
  entities: Entity[]
): Promise<Module[]> {
  const srcFolder = `${BASE_DIRECTORY}/src`;
  const dtosModules = await createModelsModules(srcFolder, appInfo, entities);
  const sdks = await createApi(
    appInfo,
    entities,
    `${srcFolder}/models/api`,
    srcFolder
  );
  return Promise.all([
    createPackageJson(appInfo, BASE_DIRECTORY),
    ...dtosModules,
    ...sdks,
  ]);
}