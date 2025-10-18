export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
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
