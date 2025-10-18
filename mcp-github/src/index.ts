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
  },
  async ({ owner, repo, title, head, base, body = "" }) => {
    try {
      const pr = await githubAPI.createPullRequest(owner, repo, title, head, base, body);
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
