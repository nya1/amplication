import { config } from "dotenv";
import { readFileSync } from "fs";
import { existsSync, outputFile, writeFileSync } from "fs-extra";
import { tmpdir, userInfo } from "os";
import { join } from "path";

config({ path: "../.env.local" });

const ENV_KEY = "BASE_BUILDS_FOLDER";
const BUILD_ENV_REGEX = new RegExp("BASE_BUILDS_FOLDER.*", "g");

const isTemp = process.env.TEMP_BUILDS?.toLowerCase() == "true";

function buildFolder(isTemp: boolean) {
  let buildFolder;

  if (isTemp) {
    buildFolder = join(tmpdir(), "amplication");
  } else {
    buildFolder = join(userInfo().homedir, "Documents");
  }
  buildFolder = join(buildFolder, "builds");

  return buildFolder;
}

export async function envSetup() {
  const ENV_FILE_PATHS_FOR_UPDATE = [
    "./packages/amplication-server/.env.local",
  ];

  await Promise.all(ENV_FILE_PATHS_FOR_UPDATE.map(assertEnvFileExist));

  ENV_FILE_PATHS_FOR_UPDATE.map((path) => {
    refactorEnvFile(path, (relativePath, newFile) => {
      writeFileSync(relativePath, newFile);
    });
  });
  return;
}

async function refactorEnvFile(
  relativePath: string,
  cb: (relativePath: string, newContact: string) => void
) {
  const buildsFolder = buildFolder(isTemp);

  const fileContact = await readFileSync(relativePath).toString();
  let newFile = fileContact;
  const env = `${ENV_KEY}="${buildsFolder}"`;
  if (fileContact.search(BUILD_ENV_REGEX) === -1) {
    newFile += "\n" + env;
  } else {
    newFile = fileContact.replace(BUILD_ENV_REGEX, env);
  }
  cb(relativePath, newFile);
}

async function assertEnvFileExist(relativePath: string) {
  const isFileExist = existsSync(relativePath);
  if (!isFileExist) {
    console.log(`Created a new env file in ${relativePath}`);
    await outputFile(relativePath, "");
  }
  return;
}
