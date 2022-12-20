import { isOnline, run } from "./functions";
import { pkgJson } from "./pkgJson";

export const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*))*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  suffix?: string;
};

export const parseVersion = (version: string): Version => {
  const match = version.trim().match(SEMVER_REGEX);
  return match
    ? {
        major: Number.parseInt(match[1]),
        minor: Number.parseInt(match[2]),
        patch: Number.parseInt(match[3]),
        suffix: match[4],
      }
    : {
        major: 0,
        minor: 0,
        patch: 0,
        suffix: "new",
      };
};

export const isFirstBefore = (first: Version, second: Version): boolean => {
  if (first.major !== second.major) {
    return first.major < second.major;
  } else if (first.minor !== second.minor) {
    return first.minor < second.minor;
  } else if (first.patch !== second.patch) {
    return first.patch < second.patch;
  } else {
    return Boolean(first.suffix && !second.suffix);
  }
};

export const getPublishedVersion = async (): Promise<Version> => {
  const { name } = pkgJson();

  if (!name) {
    throw new Error("package.json needs a name");
  }

  let currVersionStr: string;
  try {
    currVersionStr = run(`npm show '${name}' version`, {
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // this dns lookup checks if they have internet
    if (await isOnline()) {
      currVersionStr = "0.0.0-new";
    } else {
      throw new Error(`need to be online to determine latest npm version of '${name}'`);
    }
  }
  return parseVersion(currVersionStr);
};

export const versionToSemverString = (version: Version): string => {
  return `${version.major}.${version.minor}.${version.patch}${
    version.suffix ? `-${version.suffix}` : ""
  }`;
};

export const versionToHumanString = (version: Version): string => {
  if (version.major === 0 && version.major === 0 && version.patch === 0 && version.suffix) {
    return `[${version.suffix}]`;
  }
  return versionToSemverString(version);
};
