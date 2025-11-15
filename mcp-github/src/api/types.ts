export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

// ページネーション設定
export interface PaginationOptions {
  per_page?: number;  // デフォルト100
  max_pages?: number; // 最大取得ページ数（無制限の場合はundefined）
}

// Issue関連の型
export interface Issue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
  body?: string;
  labels?: { name: string }[];
}

export interface IssueComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  html_url: string;
}

export interface SearchIssuesResponse {
  items: Issue[];
}

// Pull Request関連の型
export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
  body?: string;
  head: {
    ref: string;
    sha: string;
    repo: {
      name: string;
      owner: { login: string };
    };
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      name: string;
      owner: { login: string };
    };
  };
  merged: boolean;
  mergeable?: boolean;
  draft?: boolean;
  labels?: { name: string }[];
}

export interface PullRequestComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  html_url: string;
  path?: string;
  position?: number;
}

// Branch関連の型
export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface BranchDetail {
  name: string;
  commit: {
    sha: string;
    commit: {
      author: {
        name: string;
        email: string;
        date: string;
      };
      message: string;
    };
  };
  protected: boolean;
  protection_url?: string;
}

// Git操作関連の型
export interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
  };
  html_url: string;
  parents: { sha: string }[];
  author?: {
    login: string;
  } | null;
}

// コミット詳細レスポンス（filesを含む）
export interface CommitDetail extends Commit {
  files?: CommitFile[];
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
}

// コミットファイル情報
export interface CommitFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
  previous_filename?: string;
}

export interface GitReference {
  ref: string;
  node_id: string;
  url: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
}

export interface CreateCommitResponse {
  sha: string;
  node_id: string;
  url: string;
  author: {
    date: string;
    name: string;
    email: string;
  };
  committer: {
    date: string;
    name: string;
    email: string;
  };
  message: string;
  tree: {
    url: string;
    sha: string;
  };
  parents: { url: string; sha: string }[];
}

// Compare関連の型
export interface CompareFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface CompareResponse {
  url: string;
  html_url: string;
  permalink_url: string;
  diff_url: string;
  patch_url: string;
  base_commit: Commit;
  merge_base_commit: Commit;
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: Commit[];
  files: CompareFile[];
}

// 認証関連の型
export interface AuthenticationResult {
  success: boolean;
  token?: string;
  method: 'PAT' | 'GitHub CLI';
  error?: string;
}

export interface GitHubAuthClient {
  authenticate(): Promise<AuthenticationResult>;
  makeRequest<T>(url: string, options?: RequestOptions): Promise<T>;
}
