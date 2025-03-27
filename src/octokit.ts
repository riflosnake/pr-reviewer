import { Octokit } from "@octokit/rest";
import { config } from "./config.js";

export const octokit = new Octokit({
  auth: config.GITHUB_TOKEN,
});
