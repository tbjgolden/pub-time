import { run } from "./functions";
import { parseVersion, SEMVER_REGEX, Version, getPublishedVersion, isFirstBefore } from "./version";

export type Commit = {
  hash: string;
  message: string;
  footer: string;
  versions: Version[];
  semver: "major" | "minor" | "patch" | "unknown";
};

const FEAT_REGEX = /^feat(\([^)]+\))?!?:/;
const BREAKING_CHANGE_REGEX = /^[a-z]+(\([^)]+\))?!:/;
const CONVENTIONAL_COMMIT_REGEX = /^[a-z]+(\([^)]+\))?!?:/;

export const getAllCommits = (): Commit[] => {
  const rawGitLogStr = run(`git --no-pager log --format=format:'%H$%D%n%B'`);
  const matches = [...rawGitLogStr.matchAll(/(?<=^|\n)([\da-f]{40})\$(.*)/g)];
  const commits: Commit[] = new Array(matches.length);
  let prevIndex = rawGitLogStr.length;
  for (let i = matches.length - 1; i >= 0; i--) {
    const currIndex = matches[i].index as number;
    const hash = matches[i][1];
    const refNames = matches[i][2];
    const versions = refNames
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("tag: v"))
      .map((part) => part.slice(6))
      .filter((part) => SEMVER_REGEX.test(part))
      .map((versionStr) => parseVersion(versionStr));
    const body = rawGitLogStr.slice(currIndex + 42 + matches[i][2].length, prevIndex - 1);
    let firstNewlineIndex = body.indexOf("\n");
    if (firstNewlineIndex === -1) firstNewlineIndex = Number.POSITIVE_INFINITY;
    const message = body.slice(0, firstNewlineIndex).trim();
    const footer = body.slice(firstNewlineIndex + 1).trim();
    let semver: Commit["semver"] = "unknown";
    if (BREAKING_CHANGE_REGEX.test(message) || footer.includes("BREAKING CHANGE: ")) {
      semver = "major";
    } else if (FEAT_REGEX.test(message)) {
      semver = "minor";
    } else if (CONVENTIONAL_COMMIT_REGEX.test(message)) {
      semver = "patch";
    }
    commits[i] = {
      hash,
      message,
      footer,
      versions,
      semver,
    };
    prevIndex = currIndex;
  }
  return commits;
};

export const getCommitsSinceLastRelease = async (lastHash?: string): Promise<Commit[]> => {
  const allCommits = getAllCommits();
  let i = 0;
  if (lastHash) {
    const lastHashLower = lastHash.toLowerCase();
    for (; i < allCommits.length; i++) {
      if (allCommits[i].hash.startsWith(lastHashLower)) {
        break;
      }
    }
  } else {
    for (; i < allCommits.length; i++) {
      if (allCommits[i].versions.length > 0) {
        break;
      }
    }
  }
  return allCommits.slice(0, i);
};

export type ReleaseData = {
  prev: Version;
  next: Version;
  commits: Commit[];
  majors: Commit[];
  minors: Commit[];
  patches: Commit[];
};

export const generateRelease = async (lastHash?: string): Promise<ReleaseData> => {
  const prev = await getPublishedVersion();
  const commits = await getCommitsSinceLastRelease(lastHash);

  const majors: Commit[] = [];
  const minors: Commit[] = [];
  const patches: Commit[] = [];

  let increment: "major" | "minor" | "patch" = "patch";
  for (const commit of commits) {
    if (commit.semver === "major") {
      increment = "major";
      majors.push(commit);
    } else if (commit.semver === "minor") {
      if (increment === "patch") {
        increment = "minor";
      }
      minors.push(commit);
    } else if (commit.semver === "patch") {
      patches.push(commit);
    } else {
      patches.push({
        ...commit,
        message: `unknown: ${commit.message}`,
      });
    }
  }

  let next: Version;
  if (prev.major >= 1 && isFirstBefore(prev, { major: prev.major, minor: 0, patch: 0 })) {
    next = { major: prev.major, minor: 0, patch: 0 };
  } else if (isFirstBefore(prev, { major: 0, minor: 1, patch: 0 })) {
    next = { major: prev.major, minor: 1, patch: 0 };
  } else {
    if (increment === "major") {
      next = { major: prev.major + 1, minor: 0, patch: 0 };
    } else if (increment === "minor") {
      next = { major: prev.major, minor: prev.minor + 1, patch: 0 };
    } else {
      next = { major: prev.major, minor: prev.minor, patch: prev.patch + 1 };
    }
  }

  return {
    prev,
    next,
    commits,
    majors,
    minors,
    patches,
  };
};

export const generateChangelogMarkdown = ({ majors, minors, patches }: ReleaseData): string => {
  const output = [
    majors.length > 0 ? `# Major changes (breaking)\n\n${toMarkdownList(majors)}` : "",
    minors.length > 0 ? `# Feature updates\n\n${toMarkdownList(minors)}` : "",
    patches.length > 0 ? `# Other commits\n\n${toMarkdownList(patches)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return output ? `${output}\n` : "";
};

const toMarkdownList = (commits: Commit[]) =>
  commits
    .map(({ message }) => `- ${message}`)
    .filter((message, index, arr) => index === 0 || arr[index - 1] !== message)
    .join("\n");
