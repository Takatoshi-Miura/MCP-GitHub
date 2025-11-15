import {
  Issue,
  IssueComment,
  PullRequest,
  PullRequestComment,
  BranchDetail,
  Commit,
  CommitDetail,
  GitReference,
  CreateCommitResponse,
  CompareResponse,
  RequestOptions,
  PaginationOptions
} from './types.js';
import { logger } from '../utils/logger.js';
import { parseResponseBody, createGitHubError, parseLinkHeader } from '../utils/helpers.js';
import { GitHubCLIAuth } from '../auth/github-cli-auth.js';

const GITHUB_API_BASE = 'https://api.github.com';
const AI_COMMENT_IDENTIFIER = '[AI] Generated using MCP\n\n';
const USER_AGENT = 'mcp-github/1.0.0';

export class GitHubAPI {
  private token: string | null = null;
  private authMethod: 'github-cli' | null = null;

  async initialize(): Promise<void> {
    logger.debug('Initializing GitHub API client');

    // GitHub CLI認証
    const cliAuth = await GitHubCLIAuth.getToken();
    if (cliAuth && cliAuth.authenticated) {
      this.token = cliAuth.token;
      this.authMethod = 'github-cli';
      logger.info('GitHub API authenticated using GitHub CLI');
      return;
    }

    // 認証失敗
    throw new Error('GitHub authentication failed: GitHub CLI is not authenticated. Please run: gh auth login');
  }

  private async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${GITHUB_API_BASE}${url}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    } else {
      throw new Error('GitHub authentication required');
    }

    logger.debug(`Making request: ${options.method || 'GET'} ${fullUrl} using ${this.authMethod}`);

    const response = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      logger.debug(`Request failed: ${response.status}`, body);
      throw createGitHubError(response.status, body);
    }

    logger.debug(`Request successful: ${response.status}`);
    return body as T;
  }

  /**
   * ページネーション対応のGitHub APIリクエスト
   * @param url - APIエンドポイントURL
   * @param options - リクエストオプション + ページネーション設定
   * @returns すべてのページのデータを結合した配列
   */
  private async requestPaginated<T>(
    url: string,
    options: RequestOptions & PaginationOptions = {}
  ): Promise<T[]> {
    const { per_page = 100, max_pages, ...requestOptions } = options;
    const results: T[] = [];
    let currentUrl = url;
    let pageCount = 0;

    // URLにper_pageパラメータを追加
    const separator = currentUrl.includes('?') ? '&' : '?';
    currentUrl = `${currentUrl}${separator}per_page=${per_page}`;

    while (currentUrl) {
      pageCount++;

      // 最大ページ数チェック
      if (max_pages && pageCount > max_pages) {
        logger.warn(`Reached max_pages limit: ${max_pages}`);
        break;
      }

      logger.debug(`Fetching page ${pageCount}: ${currentUrl}`);

      const fullUrl = currentUrl.startsWith('http')
        ? currentUrl
        : `${GITHUB_API_BASE}${currentUrl}`;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
        ...requestOptions.headers,
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(fullUrl, {
        method: requestOptions.method || 'GET',
        headers,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
      });

      const body = await parseResponseBody(response);

      if (!response.ok) {
        logger.debug(`Request failed: ${response.status}`, body);
        throw createGitHubError(response.status, body);
      }

      // データを配列に追加
      if (Array.isArray(body)) {
        results.push(...(body as T[]));
      } else {
        throw new Error('Expected array response for paginated request');
      }

      // 次のページURLを取得
      const linkHeader = response.headers.get('Link');
      const links = parseLinkHeader(linkHeader);
      currentUrl = links.next || '';

      logger.debug(`Page ${pageCount}: Retrieved ${(body as T[]).length} items. Total: ${results.length}`);
    }

    logger.info(`Pagination complete: ${pageCount} pages, ${results.length} total items`);
    return results;
  }

  /* ====================================================================
   * Issue Management Methods
   * ==================================================================== */

  async createIssue(owner: string, repo: string, title: string, body?: string): Promise<Issue> {
    logger.debug(`Creating issue in ${owner}/${repo}: ${title}`);
    return this.request<Issue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: { title, body: body || '' }
    });
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    logger.debug(`Getting issue #${issueNumber} from ${owner}/${repo}`);
    return this.request<Issue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' }
  ): Promise<Issue> {
    logger.debug(`Updating issue #${issueNumber} in ${owner}/${repo}`);
    return this.request<Issue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: updates
    });
  }

  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<IssueComment> {
    logger.debug(`Adding comment to issue #${issueNumber} in ${owner}/${repo}`);
    return this.request<IssueComment>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: { body: AI_COMMENT_IDENTIFIER + body }
    });
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<IssueComment[]> {
    logger.debug(`Getting comments for issue #${issueNumber} in ${owner}/${repo}`);
    return this.request<IssueComment[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
  }

  /* ====================================================================
   * Pull Request Management Methods
   * ==================================================================== */

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
    draft?: boolean
  ): Promise<PullRequest> {
    logger.debug(`Creating PR in ${owner}/${repo}: ${title} (${head} -> ${base})${draft ? ' (draft)' : ''}`);
    return this.request<PullRequest>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: { title, head, base, body: body || '', draft: draft || false }
    });
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequest> {
    logger.debug(`Getting PR #${pullNumber} from ${owner}/${repo}`);
    return this.request<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string }
  ): Promise<PullRequest> {
    logger.debug(`Updating PR #${pullNumber} in ${owner}/${repo}`);
    return this.request<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      method: 'PATCH',
      body: updates
    });
  }

  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    logger.debug(`Getting diff for PR #${pullNumber} in ${owner}/${repo}`);
    return this.request<string>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: { Accept: 'application/vnd.github.v3.diff' }
    });
  }

  async getPullRequestComments(owner: string, repo: string, pullNumber: number): Promise<PullRequestComment[]> {
    logger.debug(`Getting comments for PR #${pullNumber} in ${owner}/${repo}`);
    return this.request<PullRequestComment[]>(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`);
  }

  async addPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<PullRequestComment> {
    logger.debug(`Adding comment to PR #${pullNumber} in ${owner}/${repo}`);
    return this.request<PullRequestComment>(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
      method: 'POST',
      body: { body: AI_COMMENT_IDENTIFIER + body }
    });
  }


  /* ====================================================================
   * Commit and Compare Methods
   * ==================================================================== */

  /**
   * 個別コミットの詳細情報を取得（変更ファイル情報を含む）
   * @param owner - リポジトリオーナー
   * @param repo - リポジトリ名
   * @param ref - コミットSHA
   * @returns コミット詳細（filesを含む）
   */
  async getCommit(
    owner: string,
    repo: string,
    ref: string
  ): Promise<CommitDetail> {
    logger.debug(`Getting commit details for ${owner}/${repo}@${ref}`);
    return this.request<CommitDetail>(`/repos/${owner}/${repo}/commits/${ref}`);
  }

  /**
   * 日付範囲とオプションの作成者でコミット一覧を取得（ページネーション対応）
   * @param owner - リポジトリオーナー
   * @param repo - リポジトリ名
   * @param since - 開始日時（ISO 8601形式）
   * @param until - 終了日時（ISO 8601形式、オプション）
   * @param author - 作成者のGitHubユーザー名またはメールアドレス（オプション）
   * @param paginationOptions - ページネーション設定（オプション）
   * @returns コミット一覧
   */
  async getCommitsByDateRange(
    owner: string,
    repo: string,
    since: string,
    until?: string,
    author?: string,
    paginationOptions?: PaginationOptions
  ): Promise<Commit[]> {
    logger.debug(
      `Getting commits for ${owner}/${repo} from ${since}${until ? ` to ${until}` : ''}${author ? ` by ${author}` : ''}`
    );

    let url = `/repos/${owner}/${repo}/commits?since=${since}`;
    if (until) {
      url += `&until=${until}`;
    }
    if (author) {
      url += `&author=${encodeURIComponent(author)}`;
    }

    return this.requestPaginated<Commit>(url, paginationOptions);
  }

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<CompareResponse> {
    logger.debug(`Comparing commits in ${owner}/${repo}: ${base}...${head}`);
    return this.request<CompareResponse>(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  }

  /* ====================================================================
   * Utility Methods
   * ==================================================================== */

  getAuthStatus(): { authenticated: boolean; method?: string; details?: any } {
    return {
      authenticated: !!this.token,
      method: this.authMethod || undefined
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/user');
      return true;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    }
  }
}
