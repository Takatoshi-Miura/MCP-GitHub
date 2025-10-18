import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

export interface GitHubCLIAuthResult {
  token: string;
  authenticated: boolean;
  method: 'github-cli';
}

export class GitHubCLIAuth {

  /**
   * GitHub CLIの認証状態を確認
   */
  static async checkAuthStatus(): Promise<boolean> {
    try {
      logger.debug('Checking GitHub CLI authentication status');
      execSync('gh auth status', { stdio: 'pipe' });
      logger.debug('GitHub CLI is authenticated');
      return true;
    } catch (error) {
      logger.debug('GitHub CLI authentication check failed:', error);
      return false;
    }
  }

  /**
   * GitHub CLIからアクセストークンを取得
   */
  static async getToken(): Promise<GitHubCLIAuthResult | null> {
    try {
      logger.debug('Attempting to get token from GitHub CLI');

      // GitHub CLIの認証状態を確認
      if (!(await this.checkAuthStatus())) {
        logger.warn('GitHub CLI is not authenticated');
        return null;
      }

      // GitHub CLIからトークンを取得
      const tokenOutput = execSync('gh auth token', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).toString().trim();

      if (!tokenOutput || tokenOutput.length === 0) {
        logger.warn('GitHub CLI returned empty token');
        return null;
      }

      logger.info('Successfully retrieved token from GitHub CLI');
      return {
        token: tokenOutput,
        authenticated: true,
        method: 'github-cli'
      };

    } catch (error) {
      logger.debug('Failed to get token from GitHub CLI:', error);
      return null;
    }
  }

  /**
   * GitHub CLIの認証情報を取得（詳細）
   */
  static async getAuthInfo(): Promise<{
    authenticated: boolean;
    account?: string;
    hostname?: string;
    scopes?: string[];
  }> {
    try {
      const output = execSync('gh auth status', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).toString();

      // パース処理（簡略化）
      const authenticated = output.includes('Logged in to');
      const accountMatch = output.match(/account (\w+)/);
      const account = accountMatch ? accountMatch[1] : undefined;

      return {
        authenticated,
        account,
        hostname: 'github.com'
      };

    } catch (error) {
      return { authenticated: false };
    }
  }

  /**
   * GitHub CLIでの認証プロンプト（開発環境用）
   */
  static async promptAuth(): Promise<boolean> {
    try {
      logger.info('Prompting GitHub CLI authentication');
      execSync('gh auth login', { stdio: 'inherit' });
      return await this.checkAuthStatus();
    } catch (error) {
      logger.error('GitHub CLI authentication prompt failed:', error);
      return false;
    }
  }
}
