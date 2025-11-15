#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GitHubAPI } from './api/github-api.js';
import { logger } from './utils/logger.js';

/* ================================================================== */
/*  MCP Server                                                        */
/* ================================================================== */
const server = new McpServer({
  name: "mcp-github",
  version: "1.0.0",
  capabilities: { resources: {}, tools: {} },
});

// Initialize GitHub API client
const githubAPI = new GitHubAPI();

/* ================================================================== */
/*  Issue Tools (4 tools)                                             */
/* ================================================================== */

/* ---------- 1. create_issue ---------- */
server.tool(
  "create_issue",
  "Create a new issue in a GitHub repository",
  {
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body (markdown)"),
  },
  async ({ owner, repo, title, body = "" }) => {
    try {
      const issue = await githubAPI.createIssue(owner, repo, title, body);
      return {
        content: [{
          type: "text",
          text: `✅ Issue created!\n\n#${issue.number}: ${issue.title}\nURL: ${issue.html_url}`
        }],
      };
    } catch (error) {
      logger.error('Failed to create issue:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error creating issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 2. get_issue ---------- */
server.tool(
  "get_issue",
  "Get details of a GitHub issue including comments",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("Issue number"),
  },
  async ({ owner, repo, issue_number }) => {
    try {
      const issue = await githubAPI.getIssue(owner, repo, issue_number);
      const comments = await githubAPI.getIssueComments(owner, repo, issue_number);

      const labels = issue.labels?.map((l) => l.name).join(", ") ?? "(none)";
      let text =
        `📋 Issue #${issue.number}: ${issue.title}\n\n` +
        `State: ${issue.state}\n` +
        `Author: ${issue.user.login}\n` +
        `Created: ${new Date(issue.created_at).toLocaleString()}\n` +
        `Updated: ${new Date(issue.updated_at).toLocaleString()}\n` +
        `Labels: ${labels}\n\n` +
        `${issue.body ?? ""}\n\n` +
        `URL: ${issue.html_url}`;

      if (comments.length > 0) {
        text += `\n\n---\n💬 Comments (${comments.length}):\n\n`;
        comments.forEach((comment, index) => {
          text += `[${index + 1}] ${comment.user.login} at ${new Date(comment.created_at).toLocaleString()}\n`;
          text += `${comment.body}\n\n`;
        });
      }

      return { content: [{ type: "text", text }] };
    } catch (error) {
      logger.error('Failed to get issue:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error getting issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 3. update_issue ---------- */
server.tool(
  "update_issue",
  "Update an existing GitHub issue (title, body, or state)",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("Issue number"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body (markdown)"),
    state: z.enum(["open", "closed"]).optional().describe("New state"),
  },
  async ({ owner, repo, issue_number, title, body, state }) => {
    if (!title && !body && !state) {
      return {
        content: [{
          type: "text",
          text: "⚠️ Nothing to update. Please specify at least one field (title, body, or state)."
        }]
      };
    }

    try {
      const updates: { title?: string; body?: string; state?: 'open' | 'closed' } = {};
      if (title) updates.title = title;
      if (body) updates.body = body;
      if (state) updates.state = state;

      const issue = await githubAPI.updateIssue(owner, repo, issue_number, updates);
      return {
        content: [{
          type: "text",
          text:
            `✅ Issue #${issue.number} updated!\n\n` +
            `Title: ${issue.title}\n` +
            `State: ${issue.state}\n` +
            `URL: ${issue.html_url}`
        }],
      };
    } catch (error) {
      logger.error('Failed to update issue:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error updating issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 4. add_issue_comment ---------- */
server.tool(
  "add_issue_comment",
  "Add a comment to a GitHub issue",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issue_number: z.number().describe("Issue number"),
    body: z.string().describe("Comment body (markdown)"),
  },
  async ({ owner, repo, issue_number, body }) => {
    try {
      const comment = await githubAPI.addIssueComment(owner, repo, issue_number, body);
      return {
        content: [{
          type: "text",
          text: `✅ Comment added to issue #${issue_number}\nURL: ${comment.html_url}`
        }],
      };
    } catch (error) {
      logger.error('Failed to add comment:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error adding comment: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ================================================================== */
/*  Pull Request Tools (4 tools)                                      */
/* ================================================================== */

/* ---------- 5. create_pull_request ---------- */
server.tool(
  "create_pull_request",
  "Create a new pull request in a GitHub repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Pull request title"),
    head: z.string().describe("Name of the branch where your changes are (e.g., 'feature-branch')"),
    base: z.string().describe("Name of the branch you want to merge into (e.g., 'main')"),
    body: z.string().optional().describe("Pull request body (markdown)"),
    draft: z.boolean().optional().describe("Create as draft pull request (default: false)"),
  },
  async ({ owner, repo, title, head, base, body = "", draft }) => {
    try {
      const pr = await githubAPI.createPullRequest(owner, repo, title, head, base, body, draft);
      return {
        content: [{
          type: "text",
          text:
            `✅ Pull Request created!\n\n` +
            `#${pr.number}: ${pr.title}\n` +
            `${head} → ${base}\n` +
            `URL: ${pr.html_url}`
        }],
      };
    } catch (error) {
      logger.error('Failed to create pull request:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error creating pull request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 6. get_pull_request ---------- */
server.tool(
  "get_pull_request",
  "Get details of a GitHub pull request including comments",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pr_number: z.number().describe("Pull request number"),
  },
  async ({ owner, repo, pr_number }) => {
    try {
      const pr = await githubAPI.getPullRequest(owner, repo, pr_number);
      const comments = await githubAPI.getPullRequestComments(owner, repo, pr_number);

      const labels = pr.labels?.map((l) => l.name).join(", ") ?? "(none)";
      let text =
        `🔀 Pull Request #${pr.number}: ${pr.title}\n\n` +
        `State: ${pr.state}${pr.merged ? ' (merged)' : ''}${pr.draft ? ' (draft)' : ''}\n` +
        `Author: ${pr.user.login}\n` +
        `Created: ${new Date(pr.created_at).toLocaleString()}\n` +
        `Updated: ${new Date(pr.updated_at).toLocaleString()}\n` +
        `Labels: ${labels}\n` +
        `Branch: ${pr.head.ref} → ${pr.base.ref}\n` +
        `Mergeable: ${pr.mergeable ?? 'unknown'}\n\n` +
        `${pr.body ?? ""}\n\n` +
        `URL: ${pr.html_url}`;

      if (comments.length > 0) {
        text += `\n\n---\n💬 Comments (${comments.length}):\n\n`;
        comments.forEach((comment, index) => {
          text += `[${index + 1}] ${comment.user.login} at ${new Date(comment.created_at).toLocaleString()}\n`;
          text += `${comment.body}\n\n`;
        });
      }

      return { content: [{ type: "text", text }] };
    } catch (error) {
      logger.error('Failed to get pull request:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error getting pull request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 7. update_pull_request ---------- */
server.tool(
  "update_pull_request",
  "Update an existing GitHub pull request (title, body, state, or base branch)",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pr_number: z.number().describe("Pull request number"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body (markdown)"),
    state: z.enum(["open", "closed"]).optional().describe("New state"),
    base: z.string().optional().describe("New base branch"),
  },
  async ({ owner, repo, pr_number, title, body, state, base }) => {
    if (!title && !body && !state && !base) {
      return {
        content: [{
          type: "text",
          text: "⚠️ Nothing to update. Please specify at least one field."
        }]
      };
    }

    try {
      const updates: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string } = {};
      if (title) updates.title = title;
      if (body) updates.body = body;
      if (state) updates.state = state;
      if (base) updates.base = base;

      const pr = await githubAPI.updatePullRequest(owner, repo, pr_number, updates);
      return {
        content: [{
          type: "text",
          text:
            `✅ Pull Request #${pr.number} updated!\n\n` +
            `Title: ${pr.title}\n` +
            `State: ${pr.state}\n` +
            `Branch: ${pr.head.ref} → ${pr.base.ref}\n` +
            `URL: ${pr.html_url}`
        }],
      };
    } catch (error) {
      logger.error('Failed to update pull request:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error updating pull request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ---------- 8. get_pr_diff ---------- */
server.tool(
  "get_pr_diff",
  "Get the diff (patch) for a GitHub pull request",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pr_number: z.number().describe("Pull request number"),
  },
  async ({ owner, repo, pr_number }) => {
    try {
      const diff = await githubAPI.getPullRequestDiff(owner, repo, pr_number);
      return {
        content: [{
          type: "text",
          text: `📄 Diff for Pull Request #${pr_number}\n\n\`\`\`diff\n${diff}\n\`\`\``
        }],
      };
    } catch (error) {
      logger.error('Failed to get pull request diff:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error getting diff: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ================================================================== */
/*  Commit Tools (1 tool)                                             */
/* ================================================================== */

/* ---------- 9. get_code_changes_by_date ---------- */
server.tool(
  "get_code_changes_by_date",
  "Get code changes in a repository within a specified date range, optionally filtered by author",
  {
    owner: z.string().describe("Repository owner (e.g., 'Takatoshi-Miura')"),
    repo: z.string().describe("Repository name (e.g., 'SportsNote_iOS')"),
    since: z.string().describe("Start date in ISO 8601 format (e.g., '2025-01-01' or '2025-01-01T00:00:00Z')"),
    until: z.string().optional().describe("End date in ISO 8601 format (optional, defaults to now)"),
    author: z.string().optional().describe("Filter commits by author (GitHub username or email address)"),
  },
  async ({ owner, repo, since, until, author }) => {
    try {
      logger.info(`Fetching commits for ${owner}/${repo} from ${since}${until ? ` to ${until}` : ''}${author ? ` by ${author}` : ''}`);

      // フェーズ1: ページネーション対応でコミット一覧を取得（authorフィルタ付き）
      const commits = await githubAPI.getCommitsByDateRange(
        owner,
        repo,
        since,
        until,
        author,
        { per_page: 100 } // 最大100件/ページ、全ページ取得
      );

      if (commits.length === 0) {
        return {
          content: [{
            type: "text",
            text: `ℹ️ No commits found in ${owner}/${repo} from ${since}${until ? ` to ${until}` : ''}${author ? ` by ${author}` : ''}`
          }],
        };
      }

      logger.info(`Retrieved ${commits.length} commits. Fetching file changes for each commit...`);

      // フェーズ2: 各コミットの詳細情報を並列取得（レート制限考慮）
      const BATCH_SIZE = 10; // 一度に10コミットずつ処理
      const commitDetails: any[] = [];

      for (let i = 0; i < commits.length; i += BATCH_SIZE) {
        const batch = commits.slice(i, i + BATCH_SIZE);
        logger.debug(`Fetching commit details batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(commits.length / BATCH_SIZE)}`);

        const batchDetails = await Promise.all(
          batch.map(async commit => {
            try {
              return await githubAPI.getCommit(owner, repo, commit.sha);
            } catch (error) {
              logger.warn(`Failed to fetch commit ${commit.sha}: ${error}`);
              // エラー時は基本情報のみ返す（filesなし）
              return { ...commit, files: [] };
            }
          })
        );

        commitDetails.push(...batchDetails);

        // レート制限対策: バッチ間で少し待機（最後のバッチを除く）
        if (i + BATCH_SIZE < commits.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(`Retrieved file changes for all ${commitDetails.length} commits`);

      // フェーズ3: ファイル変更の集計
      const fileChangesMap = new Map<string, {
        additions: number;
        deletions: number;
        changes: number;
        status: Set<string>;
      }>();

      let totalAdditions = 0;
      let totalDeletions = 0;
      let totalChanges = 0;

      for (const detail of commitDetails) {
        if (!detail.files) continue;

        for (const file of detail.files) {
          totalAdditions += file.additions;
          totalDeletions += file.deletions;
          totalChanges += file.changes;

          const existing = fileChangesMap.get(file.filename);
          if (existing) {
            existing.additions += file.additions;
            existing.deletions += file.deletions;
            existing.changes += file.changes;
            existing.status.add(file.status);
          } else {
            fileChangesMap.set(file.filename, {
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
              status: new Set([file.status])
            });
          }
        }
      }

      // フェーズ4: レスポンスの構築
      const filesArray = Array.from(fileChangesMap.entries()).map(([filename, stats]) => ({
        filename,
        ...stats,
        status: Array.from(stats.status).join(', ')
      })).sort((a, b) => b.changes - a.changes); // 変更量順にソート

      let text = `📊 Code Changes in ${owner}/${repo}\n\n`;
      text += `Period: ${since}${until ? ` to ${until}` : ' to now'}\n`;
      if (author) {
        text += `Author: ${author}\n`;
      }
      text += `Commits: ${commits.length}\n`;
      text += `Files Changed: ${fileChangesMap.size}\n`;
      text += `Total Changes: ${totalChanges} lines\n`;
      text += `  Additions: +${totalAdditions} lines\n`;
      text += `  Deletions: -${totalDeletions} lines\n\n`;

      if (filesArray.length > 0) {
        text += `---\n📝 Changed Files (sorted by change volume):\n\n`;

        // 上位50ファイルのみ表示（長すぎる場合）
        const displayLimit = 50;
        const displayFiles = filesArray.slice(0, displayLimit);

        displayFiles.forEach((file, index) => {
          text += `${index + 1}. ${file.filename}\n`;
          text += `   Status: ${file.status} | Changes: ${file.changes} (+${file.additions} -${file.deletions})\n`;
        });

        if (filesArray.length > displayLimit) {
          text += `\n... and ${filesArray.length - displayLimit} more files\n`;
        }
      }

      // コミット一覧（最新10件）
      text += `\n---\n📜 Recent Commits (latest 10):\n\n`;
      const recentCommits = commits.slice(0, 10);
      recentCommits.forEach((commit, index) => {
        const date = new Date(commit.commit.author.date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const message = commit.commit.message.split('\n')[0]; // 最初の行のみ
        text += `${index + 1}. ${commit.sha.substring(0, 7)} - ${message}\n`;
        text += `   Author: ${commit.commit.author.name} | Date: ${date}\n`;
      });

      if (commits.length > 10) {
        text += `\n... and ${commits.length - 10} more commits\n`;
      }

      return {
        content: [{
          type: "text",
          text
        }],
      };
    } catch (error) {
      logger.error('Failed to get code changes:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error getting code changes: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
      };
    }
  }
);

/* ================================================================== */
/*  Main                                                              */
/* ================================================================== */
async function main() {
  try {
    logger.info('Initializing GitHub MCP Server...');

    // Initialize GitHub API authentication
    await githubAPI.initialize();

    // Log authentication status
    const authStatus = githubAPI.getAuthStatus();
    logger.info(`Authentication successful: ${authStatus.method}`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("GitHub MCP Server running on stdio");
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Fatal error in main():", err);
  process.exit(1);
});
