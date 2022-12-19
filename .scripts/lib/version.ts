const versionRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*))*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  suffix?: string;
};

export const parseVersion = (version: string): Version => {
  const match = version.trim().match(versionRegex);
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

export const firstIsBefore = (first: Version, second: Version): boolean => {
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
