import * as vscode from 'vscode';
import {CodeFeedsProvider} from './generateCodeFeeds';

export function activate(context: vscode.ExtensionContext) {

	const codeFeedsProvider = new CodeFeedsProvider(context);

	vscode.window.registerTreeDataProvider('codeFeeds', codeFeedsProvider);
	vscode.commands.registerCommand('codeFeeds.refreshEntry', () => codeFeedsProvider.refresh());
	
	vscode.commands.registerCommand('codeFeeds.showCodeFeeds', (repoApiUrl: string) => {
		//retrieve all pull requests for the repository using repoApiUrl and show them as a list in webview panel
		codeFeedsProvider.showCodeFeeds(repoApiUrl);
	});

	//register the command codeFeeds.clearGitHubToken
	vscode.commands.registerCommand('codeFeeds.clearGitHubToken', async() => {
		codeFeedsProvider.clearGitHubToken();
	});

}